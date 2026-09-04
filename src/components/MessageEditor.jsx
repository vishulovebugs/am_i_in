// src/components/MessageEditor.jsx
//
// Editable list of parsed messages with edit, flip sender, and delete controls.
// Includes a manual message builder fallback.

import { useState } from 'react';
import { createMessage, reindexMessages } from '../utils/parseChat';
import styles from './MessageEditor.module.css';

export default function MessageEditor({ messages, onChange }) {
  const [manualText, setManualText] = useState('');
  const [manualSender, setManualSender] = useState('user');

  const handleTextChange = (id, newText) => {
    const updated = messages.map(msg =>
      msg.id === id ? { ...msg, text: newText } : msg
    );
    onChange(reindexMessages(updated));
  };

  const handleFlipSender = (id) => {
    const updated = messages.map(msg =>
      msg.id === id
        ? { ...msg, sender: msg.sender === 'user' ? 'them' : 'user' }
        : msg
    );
    onChange(updated);
  };

  const handleDelete = (id) => {
    const updated = messages.filter(msg => msg.id !== id);
    onChange(reindexMessages(updated));
  };

  const handleAddManual = () => {
    if (manualText.trim().length === 0) return;

    const newMessage = createMessage(manualText.trim(), manualSender, messages.length);
    onChange([...messages, newMessage]);
    setManualText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddManual();
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>Review Messages</span>
        <span className={styles.messageCount}>
          {messages.length} message{messages.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Message list */}
      {messages.length > 0 ? (
        <div className={styles.messageList}>
          {messages.map(msg => (
            <div key={msg.id} className={styles.messageItem}>
              <div className={styles.messageHeader}>
                <span
                  className={`${styles.senderBadge} ${
                    msg.sender === 'user' ? styles.senderUser : styles.senderThem
                  }`}
                >
                  {msg.sender === 'user' ? 'You' : 'Them'}
                </span>
                <div className={styles.messageActions}>
                  <button
                    className={styles.actionButton}
                    onClick={() => handleFlipSender(msg.id)}
                    title="Flip sender"
                  >
                    ⇄
                  </button>
                  <button
                    className={styles.actionButton}
                    onClick={() => handleDelete(msg.id)}
                    title="Delete message"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <textarea
                className={styles.messageTextInput}
                value={msg.text}
                onChange={e => handleTextChange(msg.id, e.target.value)}
                rows={2}
              />

              <div className={styles.messageMeta}>
                {msg.hasEmoji && (
                  <span className={`${styles.metaTag} ${styles.metaTagEmoji}`}>
                    {msg.emojiList.length} emoji
                  </span>
                )}
                {msg.isQuestion && (
                  <span className={`${styles.metaTag} ${styles.metaTagQuestion}`}>
                    question
                  </span>
                )}
                {msg.timestamp && (
                  <span className={styles.metaTag}>
                    {new Date(msg.timestamp).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          No messages yet. Add one manually below or paste text above and click Parse.
        </div>
      )}

      {/* Manual message builder */}
      <div className={styles.manualBuilder}>
        <span className={styles.manualBuilderTitle}>Add a message manually</span>
        <div className={styles.manualBuilderRow}>
          <input
            className={styles.manualInput}
            type="text"
            value={manualText}
            onChange={e => setManualText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
          />
          <select
            className={styles.senderSelect}
            value={manualSender}
            onChange={e => setManualSender(e.target.value)}
          >
            <option value="user">You</option>
            <option value="them">Them</option>
          </select>
          <button
            onClick={handleAddManual}
            disabled={manualText.trim().length === 0}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
