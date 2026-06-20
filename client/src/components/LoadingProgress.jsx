import React from "react";
import "./LoadingProgress.css";

export default function LoadingProgress({ progress, message, subMessage }) {
  return (
    <div className="loading-progress">
      <div className="loading-content">
        <div className="loading-spinner">
          <div className="spinner-ring"></div>
        </div>
        <div className="loading-text">
          <div className="loading-message">{message}</div>
          {subMessage && <div className="loading-sub">{subMessage}</div>}
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${Math.min(progress, 100)}%` }}
          ></div>
        </div>
        <div className="progress-text">{Math.round(progress)}%</div>
      </div>
    </div>
  );
}
