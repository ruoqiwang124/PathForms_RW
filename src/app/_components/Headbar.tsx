"use client";

import React from "react";
import { useEffect } from "react";
import styles from "./components.module.css"; // Ensure that this is the correct path for your CSS module
import { useRouter } from "next/navigation";
interface HeadbarProps {
  theme: "dark" | "light";
  toggleSettings: () => void;
  showSettings: boolean;
  edgeThickness: number;
  handleEdgeThicknessChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleThemeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  shape: string;
  handleshape: () => void;
  showArrows: boolean;
  toggleArrows: () => void;
}

//function for return

const Headbar: React.FC<HeadbarProps> = ({
  theme,
  shape,
  toggleSettings,
  showSettings,
  edgeThickness,
  handleEdgeThicknessChange,

  handleThemeChange,
  handleshape,
  showArrows,
  toggleArrows,
}) => {
  const colors = [
    "rgb(255, 50, 91)",
    "rgb(0, 255, 106)",
    "rgb(246, 255, 0)",
    "rgb(255, 166, 0)",
    "rgb(255, 0, 255)",
    "rgb(255, 94, 0)",
    "rgb(255, 204, 160)",
    "rgb(152, 0, 137)",
    "rgb(255, 137, 239)",
  ];
  const text = "PathForms";
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.style.setProperty("--background", "#ffffff");
      root.style.setProperty("--foreground", "#171717");
    } else {
      root.style.setProperty("--background", "#0a0a0a");
      root.style.setProperty("--foreground", "#ededed");
    }
  }, [theme]);

  const heading = (
    <h1 style={{ cursor: "pointer" }}>
      <a
        href="https://mineyev.web.illinois.edu/PathForms/"
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: "none", display: "inline-block" }}
      >
        {text.split("").map((char, index) => (
          <span key={index} style={{ color: colors[index % colors.length] }}>
            {char}
          </span>
        ))}
      </a>
    </h1>
  );

  return (
    <div className={`${styles.header} ${styles[theme]}`}>
      {" "}
      {/* Use CSS module styling for dynamic class */}
      <div>{heading}</div>
      <button className={styles["settings-button"]} onClick={toggleSettings}
      style={{
        width: "100px",
        height: "30px",
        fontSize: "16px",
        backgroundColor: "gray",
        border: "2px solid",
        borderColor: "rgb(13, 255, 0)",
        color: "rgb(13, 255, 0)",
        cursor: "pointer",
        borderRadius: "4px",
        transition: "0.3s",
      }}>
        Settings
      </button>
      {showSettings && (
        <div className={`${styles["settings-modal"]} ${styles[theme]}`}>
          <div>
            <label>Edge Thickness:</label>
            <input
              type="range"
              min="0.7"
              max="10"
              step="0.1"
              value={edgeThickness}
              onChange={handleEdgeThicknessChange}
            />
            <span>{edgeThickness}</span>
          </div>
          <div>
            <label>Theme:</label>
            <select value={theme} onChange={handleThemeChange}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <div>
            {/* <button onClick={() => handleshape()}>shape</button> */}
            <label>Shape:</label>
            <select value={shape} onChange={handleshape}>
              <option value="circle">circle</option>
              <option value="rect">rectangle</option>
            </select>
          </div>
          <div>
            <label>Show Arrows:</label>
            <input
              type="checkbox"
              checked={showArrows}
              onChange={toggleArrows}
            />
          </div>
          <button onClick={toggleSettings}>Close</button>
        </div>
      )}
    </div>
  );
};

export default Headbar;
