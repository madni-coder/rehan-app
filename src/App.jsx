import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
    FiAlertCircle,
    FiBell,
    FiCoffee,
    FiDroplet,
    FiPhoneCall,
    FiTrash2,
    FiCopy,
} from "react-icons/fi";
import "./App.css";
import useSSE from "./hooks/useSSE";

const quickActions = [
    { label: "Food", color: "tone-blue", icon: FiCoffee },
    { label: "Water", color: "tone-green", icon: FiDroplet },
    { label: "Panic", color: "tone-red", icon: FiAlertCircle },
    { label: "Call Person", color: "tone-orange", icon: FiPhoneCall },

    { label: "Bell", color: "tone-brown", icon: FiBell },

    {
        label: "Clear All",
        color: "tone-yellow",
        icon: FiTrash2,
        action: "clear",
    },
];

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

function App() {
    const [theme] = useState("dark");
    const callOptions = ["Asad", "Irfan", "Anam", "Salman", "Ammi"];
    const [showCallDropdown, setShowCallDropdown] = useState(false);
    const [draft, setDraft] = useState("");
    const [messages, setMessages] = useState([]);
    const [labels] = useState({
        appTitle: "Rehan App",
        placeholder: "Write Your Message",
    });

    const [chatId, setChatId] = useState(null);
    const [isCreatingChat, setIsCreatingChat] = useState(false);
    const dropdownRef = useRef(null);

    const orderedMessages = useMemo(() => messages, [messages]);

    const { latestMessage, connectionStatus, error } = useSSE(
        chatId,
        BACKEND_URL
    );

    useEffect(() => {
        if (!latestMessage) return;

        try {
            const data = latestMessage;

            if (data.type === "history" && Array.isArray(data.messages)) {
                const incoming = data.messages
                    .slice()
                    .reverse()
                    .map((m) => ({
                        id: m.id || Date.now(),
                        text: m.text,
                        sender: m.isFinal ? "System" : "Patient",
                        time: m.timestamp || "",
                        isSent: false,
                    }));
                setMessages(incoming);
                return;
            }

            if (data.type === "message" && data.message) {
                const m = data.message;
                if (m.isFinal) {
                    setMessages((prev) => [
                        {
                            id: m.id || Date.now(),
                            text: m.text,
                            sender: "Patient",
                            time: m.timestamp || "",
                            isSent: false,
                        },
                        ...prev,
                    ]);
                }
            }
        } catch (err) {
            console.error("Error handling SSE message", err);
        }
    }, [latestMessage]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setShowCallDropdown(false);
            }
        };

        if (showCallDropdown) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showCallDropdown]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const roomFromUrl = params.get("room");

        if (roomFromUrl) {
            setChatId(roomFromUrl);
            return;
        }

        // Default to room "1" when no room is provided in URL
        const defaultRoom = "1";
        setChatId(defaultRoom);
        const newUrl = `${window.location.origin}${window.location.pathname}?room=${defaultRoom}`;
        window.history.replaceState({}, "", newUrl);
    }, []);

    const pushMessage = (text, isSent = true, status = "Sent") => {
        if (!text.trim()) return;
        setMessages((prev) => [
            {
                id: Date.now(),
                text: text.trim(),
                sender: isSent ? "You" : "Patient",
                time: "Just now",
                isSent,
                status,
            },
            ...prev,
        ]);
        setDraft("");
    };

    const clearAll = () => {
        setMessages([]);
        setDraft("");
    };

    const sendToBackend = useCallback(
        async (text, isFinal = false) => {
            if (!chatId) {
                if (isFinal) pushMessage(text);
                return;
            }

            try {
                await fetch(`${BACKEND_URL}/chat/${chatId}/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text, isFinal }),
                });
            } catch (err) {
                console.error("Failed to send message:", err);
                if (isFinal) pushMessage(text, true, "Failed");
            }
        },
        [chatId]
    );

    const draftSendTimeoutRef = useRef(null);
    const lastSentDraftRef = useRef("");

    useEffect(() => {
        if (draftSendTimeoutRef.current) {
            clearTimeout(draftSendTimeoutRef.current);
            draftSendTimeoutRef.current = null;
        }

        const value = draft || "";

        if (!value.trim()) return;

        if (value === lastSentDraftRef.current) return;

        draftSendTimeoutRef.current = setTimeout(() => {
            sendToBackend(value, false);
            lastSentDraftRef.current = value;
        }, 300);

        return () => {
            if (draftSendTimeoutRef.current) {
                clearTimeout(draftSendTimeoutRef.current);
                draftSendTimeoutRef.current = null;
            }
        };
    }, [draft, sendToBackend]);

    const copyLink = useCallback(async () => {
        if (!chatId) return;
        try {
            await navigator.clipboard.writeText(`?room=${chatId}`);
        } catch (err) {
            console.error("Copy failed", err);
        }
    }, [chatId]);

    return (
        <main
            className={`min-h-screen ${
                theme === "dark" ? "bg-black text-white" : "bg-white text-black"
            } font-sans`}
        >
            <div className="app-shell mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
                <header className="flex flex-col gap-2">
                    <div className="header-top">
                        <div className="header-left">
                            <h1 className="app-title">{labels.appTitle}</h1>
                        </div>

                        <div className="header-center">
                            <p className="app-subtitle">
                                {connectionStatus === "connected" ? (
                                    <span className="connected">
                                        🟢 Connected
                                    </span>
                                ) : (
                                    <span className="disconnected">
                                        🔴 Disconnected
                                    </span>
                                )}
                                {chatId && <span className="ml-2">Room: </span>}
                            </p>
                        </div>

                        <div className="header-right">
                            <button
                                className="copy-link-button"
                                onClick={copyLink}
                                type="button"
                                disabled={!chatId}
                                title={chatId ? "Copy room id" : "No room"}
                            >
                                <FiCopy className="h-8 w-8 ml-2" />
                            </button>
                        </div>
                    </div>
                    {error && <p className="text-sm text-red-400">{error}</p>}
                </header>

                <section className="flex flex-col gap-4 ">
                    <div
                        className="quick-actions-container"
                        style={{ overflow: "visible" }}
                    >
                        <div className="quick-actions-grid">
                            {quickActions.map(
                                ({ label, color, icon: Icon, action }) => {
                                    if (label === "Call Person") {
                                        return (
                                            <div
                                                key={label}
                                                className="relative block w-full"
                                                ref={dropdownRef}
                                                style={{
                                                    position: "relative",
                                                    overflow: "visible",
                                                }}
                                            >
                                                <button
                                                    className={`${color} action-button w-full`}
                                                    onClick={() =>
                                                        setShowCallDropdown(
                                                            (s) => !s
                                                        )
                                                    }
                                                    type="button"
                                                    aria-label={label}
                                                    title={label}
                                                >
                                                    <Icon className="h-5 w-5" />
                                                </button>
                                                {showCallDropdown && (
                                                    <div
                                                        className={`call-dropdown ${
                                                            theme === "dark"
                                                                ? "dark"
                                                                : "light"
                                                        }`}
                                                    >
                                                        {callOptions.map(
                                                            (name) => (
                                                                <button
                                                                    key={name}
                                                                    type="button"
                                                                    className="call-option"
                                                                    onClick={() => {
                                                                        pushMessage(
                                                                            `${name} Ko Bulao`
                                                                        );
                                                                        setShowCallDropdown(
                                                                            false
                                                                        );
                                                                    }}
                                                                >
                                                                    {name}
                                                                </button>
                                                            )
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }

                                    return (
                                        <button
                                            key={label}
                                            className={`${color} action-button w-full`}
                                            onClick={() =>
                                                action === "clear"
                                                    ? clearAll()
                                                    : (pushMessage(
                                                          label === "Water"
                                                              ? "Paani Do"
                                                              : label
                                                      ),
                                                      sendToBackend(
                                                          label === "Water"
                                                              ? "Paani Do"
                                                              : label
                                                      ))
                                            }
                                            type="button"
                                            aria-label={label}
                                            title={label}
                                        >
                                            <Icon className="h-5 w-5" />
                                        </button>
                                    );
                                }
                            )}
                        </div>
                    </div>

                    <div className="glass-panel">
                        <div className="flex items-center justify-between pb-3">
                            <p className="text-sm uppercase tracking-[0.18em] text-white font-semibold bg-white/5 px-3 py-1 rounded-lg">
                                {labels.history}
                            </p>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-zinc-500">
                                    {labels.newestFirst}
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 messages-list">
                            {draft.trim() && (
                                <article className="message-card latest-message live-preview">
                                    <p className="mt-2 text-sm leading-relaxed message-text live-message-text">
                                        {draft}
                                    </p>
                                </article>
                            )}
                            {orderedMessages.map((message, idx) => (
                                <article
                                    key={message.id}
                                    className={`message-card ${
                                        message.isSent
                                            ? "sent-message"
                                            : "received-message"
                                    } ${idx === 0 ? "latest-message" : ""}`}
                                >
                                    <p className="text-2xl leading-relaxed message-text">
                                        {message.text}
                                    </p>
                                </article>
                            ))}
                            {!orderedMessages.length && (
                                <p className="text-sm text-zinc-500">
                                    {labels.noMessages}
                                </p>
                            )}
                        </div>
                    </div>
                </section>

                <footer className="sticky bottom-0 backdrop-blur">
                    <div className="glass-panel flex flex-col gap-3">
                        <label
                            className="text-xs uppercase tracking-[0.2em] text-zinc-500"
                            htmlFor="message"
                        >
                            {labels.newMessage}
                        </label>
                        <div className="flex items-center gap-3">
                            <textarea
                                id="message"
                                className="message-input"
                                placeholder={labels.placeholder}
                                value={draft}
                                rows={3}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        const text = draft;
                                        pushMessage(text);
                                        sendToBackend(text, true);
                                        lastSentDraftRef.current = "";
                                    }
                                }}
                            />
                            {/* Send button removed per request */}
                        </div>
                    </div>
                </footer>
            </div>
        </main>
    );
}

export default App;
