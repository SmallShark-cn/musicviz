import React from "react";
import "./LoadingPage.css";

export default function LoadingPage({ artists, currentArtist, progress, status }) {
  return (
    <div className="loading-page">
      <div className="loading-page-content">
        <div className="loading-logo">
          <div className="logo-spinner">
            <div className="logo-ring"></div>
          </div>
          <h1>正在加载数据...</h1>
        </div>

        <div className="progress-container">
          <div className="progress-track">
            <div
              className="progress-thumb"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="progress-label">{Math.round(progress)}%</div>
        </div>

        <div className="status-text">{status}</div>

        <div className="artist-list">
          <div className="artist-list-title">待处理任务 ({artists.length})</div>
          {artists.map((artist, index) => {
            const name = artist.name || artist;
            const artistStatus = artist.status || (index === 0 ? "processing" : "pending");

            const isComplete = artistStatus === "done";
            const isCurrent = artistStatus === "processing";

            return (
              <div
                key={index}
                className={`artist-item ${isComplete ? "complete" : ""} ${isCurrent ? "current" : ""}`}
              >
                <span className="artist-icon">
                  {isComplete ? "✅" : isCurrent ? "⏳" : "⭕"}
                </span>
                <span className="artist-name">{name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}