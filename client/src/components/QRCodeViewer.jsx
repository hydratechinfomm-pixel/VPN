import React, { useState } from 'react';

const QRCodeViewer = ({ device, qrCode, config, onClose, onDownload }) => {
  const [clipboardMessage, setClipboardMessage] = useState('');

  const handleCopyToClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(config);
        setClipboardMessage('Configuration copied to clipboard!');
        setTimeout(() => setClipboardMessage(''), 3000);
      } else {
        // Fallback for older browsers or non-HTTPS environments
        const textArea = document.createElement('textarea');
        textArea.value = config;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setClipboardMessage('Configuration copied to clipboard!');
        setTimeout(() => setClipboardMessage(''), 3000);
      }
    } catch (err) {
      setClipboardMessage('Failed to copy. Please try downloading instead.');
      setTimeout(() => setClipboardMessage(''), 3000);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content qr-modal">
        <div className="modal-header">
          <h2>Device Configuration - {device?.name}</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="qr-content">
          <div className="qr-code-section">
            <h3>Scan QR Code</h3>
            {qrCode && (
              <img src={qrCode} alt="WireGuard QR Code" className="qr-image" />
            )}
            <p className="qr-instructions">
              Scan this QR code with your WireGuard app to import the configuration.
            </p>
          </div>

          <div className="config-section">
            <h3>Configuration File</h3>
            <div className="config-preview">
              <pre>{config}</pre>
            </div>
            <div className="config-actions">
              <button className="btn-primary" onClick={onDownload}>
                Download .conf File
              </button>
              <button
                className="btn-secondary"
                onClick={handleCopyToClipboard}
              >
                Copy to Clipboard
              </button>
              {clipboardMessage && (
                <p className="clipboard-message">{clipboardMessage}</p>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default QRCodeViewer;
