"use client";
import React, { useState } from "react";
import {
  Direction,
  reduceMoves,
  concatenate,
  invert,
} from "../utils/NielsenTrans";

interface CheckNielsenProps {
  movePaths: Direction[][];
  tutorialActive?: boolean;
  tutorialStep?: number;
  onTutorialCheck?: (step: number) => void;
}

const CheckNielsen: React.FC<CheckNielsenProps> = ({
  movePaths,
  tutorialActive = false,
  tutorialStep = 0,
  onTutorialCheck = () => {},
}) => {
  const [result, setResult] = useState<string>("");

  function checkNielsenReduced(paths: Direction[][]): boolean[] {
    let result: boolean[] = [];
    //N0
    const reducedPaths = paths.map((p) => reduceMoves(p));
    result.push(true);
    for (let i = 0; i < reducedPaths.length; i++) {
      if (reducedPaths[i].length === 0) {
        result[0] = false;
        break;
      }
    }
    //N1

    result.push(true);
    for (let a = 0; a < reducedPaths.length; a++) {
      for (let b = 0; b < reducedPaths.length; b++) {
        if (a !== b) {
          let concatPath = concatenate(reducedPaths[a], reducedPaths[b]);
          let concatPath2 = concatenate(
            reducedPaths[a],
            invert(reducedPaths[b])
          );
          if (
            concatPath.length < reducedPaths[a].length ||
            concatPath.length < reducedPaths[b].length ||
            concatPath2.length < reducedPaths[a].length ||
            concatPath2.length < reducedPaths[b].length
          ) {
            result[1] = false;
            break;
          }
        }
      }
    }
    //N2
    result.push(true);
    for (let a = 0; a < reducedPaths.length; a++) {
      for (let b = 0; b < reducedPaths.length; b++) {
        for (let c = 0; c < reducedPaths.length; c++) {
          if (a !== b && a !== c && b !== c) {
            let concatPath = concatenate(
              concatenate(reducedPaths[a], reducedPaths[b]),
              reducedPaths[c]
            );
            let concatPath2 = concatenate(
              concatenate(reducedPaths[a], reducedPaths[b]),
              invert(reducedPaths[c])
            );
            let concatPath3 = concatenate(
              concatenate(reducedPaths[a], invert(reducedPaths[b])),
              reducedPaths[c]
            );
            let concatPath4 = concatenate(
              concatenate(reducedPaths[a], invert(reducedPaths[b])),
              invert(reducedPaths[c])
            );
            if (
              concatPath.length <=
                reducedPaths[a].length -
                  reducedPaths[b].length +
                  reducedPaths[c].length ||
              concatPath2.length <=
                reducedPaths[a].length -
                  reducedPaths[b].length +
                  reducedPaths[c].length ||
              concatPath3.length <=
                reducedPaths[a].length -
                  reducedPaths[b].length +
                  reducedPaths[c].length ||
              concatPath4.length <=
                reducedPaths[a].length -
                  reducedPaths[b].length +
                  reducedPaths[c].length
            ) {
              result[2] = false;
              break;
            }
          }
        }
      }
    }
    return result;
  }

  const handleCheck = () => {
    check();
    if (tutorialStep === 7 && onTutorialCheck) {
      onTutorialCheck(8);
    }

    if (tutorialStep === 8 && onTutorialCheck) {
      const reducedConditionStatus = checkNielsenReduced(movePaths);
      const isSuccess = reducedConditionStatus.every((cond) => cond === true);
      if (isSuccess) {
        alert("🎉 Congrats! You have successfully reduced the paths!");
        onTutorialCheck(0);
      }
      return;
    }
  };
  function check() {
    const reducedConditionStatus = checkNielsenReduced(movePaths);
    if (reducedConditionStatus.every((condition) => condition === true)) {
      setResult("Success: The word list satisfies Nielsen Reduced Form!");
    } else {
      let resultstatements = "Failure: ";
      if (reducedConditionStatus[0] === false) {
        resultstatements += " The word list does not satisfy N0. ";
      }
      if (reducedConditionStatus[1] === false) {
        resultstatements +=
          " The word list does not satisfy Nielsen condition N1. The words can be further shortened. ";
      }
      if (reducedConditionStatus[2] === false) {
        resultstatements += " The word list does not satisfy N2.";
      }
      setResult(resultstatements);
    }
  }

  return (
    <div
    style={{
      position: "absolute",
      bottom: "85%",
      left: "95.3%",
      transform: "translateX(-50%)",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      padding: "10px",
      borderRadius: "8px",
      zIndex: 10,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      fontSize: "0.8rem",
    }}
  >
  <div style={{ position: "relative" }}>
    <button
      id="checkBtn"
      style={{
        height: "35px",
        width: "100%",
        fontSize: "14px",
        cursor: "pointer",
        borderRadius: "4px",
        transition: "0.1s ease-in-out",
        backgroundColor: "transparent",
        color: "rgb(13, 255, 0)",
        borderColor: "rgb(13, 255, 0)",
      }}
      onClick={handleCheck}
    >
      Check
    </button>
    {result && (
      <span
      style={{
// <<<<<<< HEAD
//         position: "absolute",
//         top: "110%",
//         left: "50%",
//         transform: "translateX(-50%)",
//         width: "140px",         
//         maxWidth: "300px",     
    
//         whiteSpace: "normal",
//         wordWrap: "break-word",
//         color: "rgb(255, 255, 0)",
//         textAlign: "center",
//         marginTop: "4px",
// =======
        position: "fixed",
        top: "15%",
        left: "90%",
        transform: "translateX(-50%)",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        padding: "10px",
        borderRadius: "8px",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        fontSize: "0.8rem",
// >>>>>>> a6661922ee805a836379e509b11676cc1ed9f176
      }}
    >
      {result}
    </span>
    )}
  </div>
  </div>
  );
};

export default CheckNielsen;
