import React from 'react';

const QRCodeViewer = ({ device, qrCode, config, onClose, onDownload }) => {
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
                onClick={() => {
                  navigator.clipboard.writeText(config);
                  alert('Configuration copied to clipboard!');
                }}
              >
                Copy to Clipboard
              </button>
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
