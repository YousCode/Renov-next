"use client";
import { useSelector } from "react-redux";

const DebugState = () => {
  const user = useSelector((state) => state.Auth.user);
  console.log("Current user state:", user);
  return null;
};

export default DebugState;