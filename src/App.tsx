import React, { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

function TextToSpeech() {
  const [text, setText] = useState("");
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [script, setScript] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [backgroundMusic, setBackgroundMusic] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [editingLine, setEditingLine] = useState(null); // State for editing lines
  const scriptRef = useRef(script);

  useEffect(() => {
    scriptRef.current = script;
  }, [script]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      alert("Sorry, your browser does not support Speech Synthesis.");
    }
  }, []);

  useEffect(() => {
    const synth = window.speechSynthesis;
    const loadVoices = () => {
      let availableVoices = synth.getVoices();
      let nonGoogleVoices = availableVoices.filter(
        (voice) => !voice.name.startsWith("Google")
      );
      if (nonGoogleVoices.length === 0) {
        nonGoogleVoices = availableVoices;
      }
      setVoices(nonGoogleVoices);
      setSelectedVoice(nonGoogleVoices[0] || null);
    };
    synth.addEventListener("voiceschanged", loadVoices);
    loadVoices();
    return () => {
      synth.removeEventListener("voiceschanged", loadVoices);
      scriptRef.current.forEach((line) => {
        if (line.type === "audio" && line.audioUrl) {
          URL.revokeObjectURL(line.audioUrl);
        }
      });
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (script.length > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [script]);

  // Voice change handler
  const handleVoiceChange = (e) => {
    const voiceName = e.target.value;
    const voice = voices.find((v) => v.name === voiceName);
    setSelectedVoice(voice);
  };

  // Add speech line to script
  const handleAddLine = () => {
    if (selectedVoice && text.trim() !== "") {
      const newLine = {
        id: uuidv4(),
        type: "speech",
        voiceName: selectedVoice.name,
        text: text.trim(),
      };
      setScript((prevScript) => [...prevScript, newLine]);
      setText("");
    } else {
      alert("Please select a voice and enter text before adding a line.");
    }
  };

  // Upload audio file and add to script
  const handleAudioUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        const base64Data = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
        const newLine = {
          id: uuidv4(),
          type: "audio",
          fileName: file.name,
          audioData: base64Data,
          audioUrl: URL.createObjectURL(file),
          audioType: "effect",
        };
        setScript((prevScript) => [...prevScript, newLine]);
      } catch (error) {
        console.error("Error adding audio file:", error);
        alert("Error adding audio file. Please try again.");
      }
    }
  };

  // Delete a line from the script
  const handleDeleteLine = (lineId) => {
    setScript((prevScript) => {
      const newScript = prevScript.filter((line) => line.id !== lineId);
      const deletedLine = prevScript.find((line) => line.id === lineId);
      if (deletedLine && deletedLine.type === "audio" && deletedLine.audioUrl) {
        URL.revokeObjectURL(deletedLine.audioUrl);
      }
      return newScript;
    });
  };

  // Copy an audio line
  const handleCopyAudio = async (line) => {
    if (line.type === "audio") {
      try {
        const response = await fetch(line.audioUrl || line.audioData);
        const blob = await response.blob();
        const newAudioUrl = URL.createObjectURL(blob);
        const newLine = {
          id: uuidv4(),
          type: "audio",
          fileName: `Copy of ${line.fileName}`,
          audioData: line.audioData,
          audioUrl: newAudioUrl,
          audioType: line.audioType,
        };
        setScript((prevScript) => [...prevScript, newLine]);
      } catch (error) {
        console.error("Error copying audio:", error);
        alert("Error copying audio. Please try again.");
      }
    }
  };

  // Delete the entire script
  const handleDeleteScript = () => {
    if (window.confirm("Are you sure you want to delete the script?")) {
      script.forEach((line) => {
        if (line.type === "audio" && line.audioUrl) {
          URL.revokeObjectURL(line.audioUrl);
        }
      });
      setScript([]);
    }
  };

  // Start editing a line
  const handleStartEdit = (lineId) => {
    setEditingLine(lineId);
  };

  // Save edited line//
  //Update the handleSaveEdit function
  const handleSaveEdit = (lineId, newText) => {
    setScript((prevScript) =>
      prevScript.map((line) =>
        line.id === lineId ? { ...line, text: newText } : line
      )
    );
  };
  // Cancel editing
  const handleCancelEdit = () => {
    setEditingLine(null);
  };

  // Handle playback of the script
  const handleSpeak = async () => {
    // If already playing, stop playback
    if (isPlaying) {
      window.speechSynthesis.cancel();
      if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
        setBackgroundMusic(null);
      }
      setIsProcessing(false);
      setIsPlaying(false);
      return;
    }

    // Check if script is empty
    if (script.length === 0) {
      alert(
        "The script is empty. Please add lines to the script before speaking."
      );
      return;
    }

    // Start playback
    window.speechSynthesis.cancel();
    setIsProcessing(true);
    setIsPlaying(true);

    let currentBackgroundMusic = null;

    try {
      for (const line of script) {
        if (line.type === "speech") {
          await new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(line.text);
            const voice = voices.find((v) => v.name === line.voiceName);
            if (voice) {
              utterance.voice = voice;
            }
            utterance.onend = () => {
              resolve();
            };
            window.speechSynthesis.speak(utterance);
          });
        } else if (line.type === "audio") {
          const audio = new Audio(line.audioUrl || line.audioData);

          if (line.audioType === "background") {
            if (currentBackgroundMusic) {
              currentBackgroundMusic.pause();
              currentBackgroundMusic.currentTime = 0;
            }
            audio.volume = 0.4;
            await audio.play();
            currentBackgroundMusic = audio;
            setBackgroundMusic(audio);
          } else if (line.audioType === "effect") {
            try {
              await audio.play();
              await new Promise((resolve) => {
                audio.onended = () => {
                  audio.pause();
                  audio.currentTime = 0;
                  resolve();
                };
              });
            } catch (error) {
              console.error("Error playing sound effect:", error);
            }
          }
        }
      }
    } catch (error) {
      console.error("Playback error:", error);
    } finally {
      if (currentBackgroundMusic) {
        currentBackgroundMusic.pause();
        currentBackgroundMusic.currentTime = 0;
      }
      setIsProcessing(false);
      setIsPlaying(false);
    }
  };

  // Save the script to a file
  const handleSaveScript = () => {
    if (script.length === 0) {
      alert("The script is empty. There is nothing to save.");
      return;
    }
    const scriptToSave = script.map((line) => {
      if (line.type === "audio") {
        const { audioUrl, ...rest } = line;
        return rest;
      }
      return line;
    });
    const scriptData = JSON.stringify(scriptToSave, null, 2);
    const blob = new Blob([scriptData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "script.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Load a script from a file
  const handleLoadScript = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const loadedScript = JSON.parse(e.target.result);
          const isValidScript =
            Array.isArray(loadedScript) &&
            loadedScript.every((line) => {
              return (
                (line.type === "speech" &&
                  typeof line.text === "string" &&
                  typeof line.voiceName === "string") ||
                (line.type === "audio" &&
                  typeof line.audioData === "string" &&
                  typeof line.fileName === "string")
              );
            });
          if (!isValidScript) {
            throw new Error("Invalid script file format.");
          }
          const processedScript = loadedScript.map((line) => {
            if (line.type === "audio" && line.audioData) {
              return {
                ...line,
                audioUrl: line.audioData,
                id: uuidv4(),
                audioType: line.audioType || "effect",
              };
            } else {
              return { ...line, id: uuidv4() };
            }
          });
          setScript(processedScript);
        } catch (error) {
          console.error("Error parsing script file:", error);
          alert(
            "Error parsing script file. Please check the console for details."
          );
        }
      };
      reader.readAsText(file);
    }
  };

  // Change audio type (effect or background)
  const handleAudioTypeChange = (lineId, audioType) => {
    setScript((prevScript) =>
      prevScript.map((line) =>
        line.id === lineId ? { ...line, audioType } : line
      )
    );
  };

  return (
    <div className="max-w-lg mx-auto p-4 bg-white rounded shadow-md">
      <div className="flex space-x-4 mb-4">
        <button
          className={`flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ${
            script.length === 0 ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={handleSpeak}
          disabled={script.length === 0}
        >
          {isProcessing ? "Playing..." : isPlaying ? "Stop" : "Play Script"}
        </button>
        <button
          className="flex-1 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
          onClick={handleDeleteScript}
        >
          Delete Script
        </button>
      </div>
      {/* Text input and voice selection */}
      <label
        htmlFor="text-input"
        className="block text-gray-700 font-bold mb-2"
      >
        Enter Text:
      </label>
      <textarea
        id="text-input"
        className="w-full p-2 mb-4 border border-gray-400 rounded"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter text to add to script"
        rows={3}
      ></textarea>
      <label
        htmlFor="voice-select"
        className="block text-gray-700 font-bold mb-2"
      >
        Select a Voice:
      </label>
      <select
        id="voice-select"
        className="w-full p-2 mb-4 border border-gray-400 rounded"
        value={selectedVoice?.name || ""}
        onChange={handleVoiceChange}
      >
        <option value="">Select a voice</option>
        {voices.map((voice) => (
          <option key={voice.name} value={voice.name}>
            {voice.name} ({voice.lang})
          </option>
        ))}
      </select>
      {/* Add speech line and audio file buttons */}
      <div className="flex space-x-4 mb-4">
        <button
          className={`flex-1 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded ${
            !selectedVoice || text.trim() === ""
              ? "opacity-50 cursor-not-allowed"
              : ""
          }`}
          onClick={handleAddLine}
          disabled={!selectedVoice || text.trim() === ""}
        >
          Add Speech Line
        </button>
        <label
          htmlFor="audio-upload"
          className="flex-1 bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded text-center cursor-pointer"
        >
          Add Audio File
          <input
            id="audio-upload"
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleAudioUpload}
          />
        </label>
      </div>
      {/* Save and load script buttons */}
      <div className="flex space-x-4 mb-4">
        <button
          className="flex-1 bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
          onClick={handleSaveScript}
        >
          Save Script
        </button>
        <label
          htmlFor="load-script"
          className="flex-1 bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded text-center cursor-pointer"
        >
          Load Script
          <input
            type="file"
            id="load-script"
            accept=".json"
            className="hidden"
            onChange={handleLoadScript}
          />
        </label>
      </div>
      {/* Script display */}
      <div className="mb-4">
        {script.length === 0 ? (
          <p className="text-gray-500">
            The script is empty. Add lines to the script above.
          </p>
        ) : (
          script.map((line) => (
            <div key={line.id} className="flex flex-row mb-4 items-center">
              {line.type === "speech" ? (
                <>
                  <span className="w-1/4 text-gray-600">{line.voiceName}</span>
                  {editingLine === line.id ? (
                    <input
                      type="text"
                      className="w-1/2 p-1 border border-gray-400 rounded"
                      value={line.text}
                      onChange={(e) => handleSaveEdit(line.id, e.target.value)}
                      onBlur={() => setEditingLine(null)}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="w-1/2 text-gray-800 cursor-pointer"
                      onClick={() => handleStartEdit(line.id)}
                    >
                      {line.text}
                    </span>
                  )}
                  <button
                    className="ml-2 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded"
                    onClick={() => handleDeleteLine(line.id)}
                  >
                    Delete
                  </button>
                </>
              ) : (
                <div className="flex items-center space-x-2 w-full">
                  <span className="w-1/4 text-gray-600">
                    Audio: {line.fileName}
                  </span>
                  <audio
                    controls
                    className="w-1/4"
                    src={line.audioUrl || line.audioData}
                  />
                  <select
                    className="w-1/4 p-1 border border-gray-400 rounded"
                    value={line.audioType || "effect"}
                    onChange={(e) =>
                      handleAudioTypeChange(line.id, e.target.value)
                    }
                  >
                    <option value="effect">Sound Effect</option>
                    <option value="background">Background Music</option>
                  </select>
                  <div className="flex space-x-2">
                    <button
                      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded"
                      onClick={() => handleCopyAudio(line)}
                    >
                      Copy
                    </button>
                    <button
                      className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded"
                      onClick={() => handleDeleteLine(line.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default TextToSpeech;
