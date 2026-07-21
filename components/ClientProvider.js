// components/ClientProvider.js

"use client";

import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { setUser } from "../redux/reducers/authReducer";
import axios from 'axios';

const ClientProvider = ({ children }) => {
  const dispatch = useDispatch();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await axios.get('/api/auth/me');
        if (response.data.ok) {
          const { email, name, language, role } = response.data.user;
          dispatch(setUser({ email, name, language, role })); // Passez uniquement les champs nécessaires
        }
      } catch (error) {
        // 401 = simplement pas connecté : pas une erreur à logger
        if (error?.response?.status !== 401) {
          console.error("Failed to check auth:", error);
        }
      }
    };

    checkAuth();
  }, [dispatch]);

  return children;
};

export default ClientProvider;
