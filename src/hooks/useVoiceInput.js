import { useState, useRef, useEffect } from "react";

export const useVoiceInput = ({ onTranscript }) => {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);

    useEffect(() => {
        return () => {
            recognitionRef.current?.stop();
        };
    }, []);

    const startListening = () => {
        if (isListening) return;

        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            alert("Speech recognition is not supported in this browser.");
            return;
        }

        let recognition = recognitionRef.current;

        if (!recognition) {
            recognition = new SpeechRecognition();

            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = "en-IN";

            recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map(result => result[0].transcript)
                    .join("");

                onTranscript(transcript);
            };

            recognition.onerror = (event) => {
                console.error("Speech recognition error:", event.error);
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current = recognition;
        }

        try {
            recognition.start();
            setIsListening(true);
        } catch (error) {
            // Prevents "recognition has already started" errors
            console.warn("Speech recognition is already running.");
        }
    };

    const stopListening = () => {
        recognitionRef.current?.stop();
        setIsListening(false);
    };

    return {
        isListening,
        startListening,
        stopListening
    };
};