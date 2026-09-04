// src/components/OCRUploader.jsx
//
// Upload an image and run OCR client-side using tesseract.js.
// Extracted text is displayed for review before feeding into parseChatText.

import { useState, useRef, useCallback } from 'react';
import { createWorker } from 'tesseract.js';
import styles from './OCRUploader.module.css';

export default function OCRUploader({ onTextExtracted }) {
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [confidence, setConfidence] = useState(null);
  const [lowConfidenceWords, setLowConfidenceWords] = useState([]);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);

  // Handle file selection
  const handleFileSelect = useCallback((file) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, etc.)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image file is too large. Maximum size is 10MB.');
      return;
    }

    setImageFile(file);
    setError(null);
    setExtractedText('');
    setConfidence(null);
    setLowConfidenceWords([]);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  }, []);

  // Handle drag and drop
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  }, [handleFileSelect]);

  // Handle file input change
  const handleInputChange = useCallback((e) => {
    const file = e.target.files[0];
    handleFileSelect(file);
  }, [handleFileSelect]);

  // Run OCR
  const runOCR = useCallback(async () => {
    if (!imageFile) return;

    setIsProcessing(true);
    setProgress(0);
    setStatus('Initializing OCR engine...');
    setError(null);

    try {
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status) {
            setStatus(m.status);
          }
          if (m.progress !== undefined) {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const { data } = await worker.recognize(imageFile);

      // Extract text and confidence
      setExtractedText(data.text);
      setConfidence(data.confidence);

      // Find low-confidence words (below 60%)
      const lowConfWords = data.words
        ?.filter((word) => word.confidence < 60)
        .map((word) => ({
          text: word.text,
          confidence: Math.round(word.confidence),
        })) || [];

      setLowConfidenceWords(lowConfWords);

      await worker.terminate();
    } catch (err) {
      console.error('OCR error:', err);
      setError('Failed to process image. Please try again with a clearer image.');
    } finally {
      setIsProcessing(false);
    }
  }, [imageFile]);

  // Accept extracted text
  const handleAccept = useCallback(() => {
    if (extractedText) {
      onTextExtracted(extractedText);
    }
  }, [extractedText, onTextExtracted]);

  // Reset and try again
  const handleRetry = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
    setExtractedText('');
    setConfidence(null);
    setLowConfidenceWords([]);
    setError(null);
    setProgress(0);
    setStatus('');
  }, []);

  // Get confidence badge class
  const getConfidenceClass = () => {
    if (confidence === null) return '';
    if (confidence >= 80) return styles.confidenceHigh;
    if (confidence >= 60) return styles.confidenceMedium;
    return styles.confidenceLow;
  };

  return (
    <div className={styles.container}>
      {/* Privacy note */}
      <div className={styles.privacyNote}>
        <span className={styles.privacyIcon}>🔒</span>
        <span>
          This processes your image entirely in your browser — nothing is uploaded to any server.
          Only the extracted text will be used for analysis.
        </span>
      </div>

      {/* Error state */}
      {error && <div className={styles.errorState}>{error}</div>}

      {/* Upload area (shown when no image selected) */}
      {!imageFile && !isProcessing && (
        <div
          className={`${styles.uploadArea} ${isDragging ? styles.uploadAreaDragging : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className={styles.uploadIcon}>📸</div>
          <div className={styles.uploadText}>
            <span className={styles.uploadTextStrong}>Click to upload</span> or drag and drop
            <br />
            PNG, JPG up to 10MB
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className={styles.fileInput}
            accept="image/*"
            onChange={handleInputChange}
          />
        </div>
      )}

      {/* Image preview and OCR progress */}
      {(imageFile || isProcessing) && (
        <>
          {imagePreview && (
            <div style={{ textAlign: 'center' }}>
              <img
                src={imagePreview}
                alt="Uploaded screenshot"
                style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }}
              />
            </div>
          )}

          {/* Progress indicator */}
          {isProcessing && (
            <div className={styles.progressSection}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className={styles.progressText}>{progress}%</div>
              <div className={styles.progressStatus}>{status}</div>
            </div>
          )}

          {/* Action buttons (before OCR) */}
          {!isProcessing && !extractedText && (
            <div className={styles.actionRow}>
              <button
                className={`${styles.actionButton} ${styles.acceptButton}`}
                onClick={runOCR}
              >
                Extract Text (OCR)
              </button>
              <button
                className={`${styles.actionButton} ${styles.retryButton}`}
                onClick={handleRetry}
              >
                Choose Different Image
              </button>
            </div>
          )}
        </>
      )}

      {/* OCR Results */}
      {extractedText && !isProcessing && (
        <div className={styles.resultsSection}>
          {/* Confidence badge */}
          {confidence !== null && (
            <div className={`${styles.confidenceBadge} ${getConfidenceClass()}`}>
              OCR Confidence: {Math.round(confidence)}%
            </div>
          )}

          {/* Extracted text */}
          <div className={styles.extractedTextLabel}>Extracted Text:</div>
          <div className={styles.extractedText}>{extractedText}</div>

          {/* Low confidence warning */}
          {lowConfidenceWords.length > 0 && (
            <div className={styles.lowConfidenceWarning}>
              ⚠️ Some words had low OCR confidence and may need manual review:
              <br />
              {lowConfidenceWords.slice(0, 5).map((word, i) => (
                <span key={i}>
                  &quot;{word.text}&quot; ({word.confidence}%)
                  {i < Math.min(lowConfidenceWords.length, 5) - 1 ? ', ' : ''}
                </span>
              ))}
              {lowConfidenceWords.length > 5 && (
                <span> and {lowConfidenceWords.length - 5} more...</span>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className={styles.actionRow}>
            <button
              className={`${styles.actionButton} ${styles.acceptButton}`}
              onClick={handleAccept}
            >
              Use This Text
            </button>
            <button
              className={`${styles.actionButton} ${styles.retryButton}`}
              onClick={handleRetry}
            >
              Try Different Image
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
