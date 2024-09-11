"use client";
import React, { useState, useEffect } from "react";
import { toast, Toaster } from "react-hot-toast";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import API from "@/services/api";
import Navbar from "@/components/Navbar";

const AccountPage = () => {
  const { t } = useTranslation();
  const i18n = useTranslation().i18n;
  const [values, setValues] = useState({
    name: "",
    email: "",
    language: "",
    password: "",
    confirmPassword: ""
  });

  const user = useSelector((state) => state.Auth.user);
  //   console.log("User from Redux:", user);

  useEffect(() => {
    if (user) {
      setValues((prevValues) => ({
        ...prevValues,
        name: user.name || "",
        email: user.email || "",
        language: user.language || ""
      }));
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues((prevValues) => ({
      ...prevValues,
      [name]: value
    }));
    // console.log("Updated values:", values);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!values.password || !values.confirmPassword) {
      toast.error("Les champs de mot de passe ne peuvent pas être vides");
      return;
    }
    if (values.password !== values.confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    try {
      const response = await API.put(`/api/auth/${user._id}`, values);
      const { ok } = response.data;
      if (ok) {
        if (typeof i18n.changeLanguage === 'function') {
          i18n.changeLanguage(values.language);
        }
        toast.success("Votre compte a bien été mis à jour");
      } else {
        toast.error("Failed to update account", response.data);
      }
    } catch (error) {
      toast.error("Error updating account");
    }
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div>
      <Navbar />
      <div className="p-6 max-w-5xl w-full mx-auto rounded-lg">
        <Toaster />
        <section className="relative">
          <h2 className="text-2xl font-bold text-white mb-4">
            Mon compte
          </h2>
          <form
            className="grid grid-cols-2 gap-x-2.5 gap-y-4"
            onSubmit={handleSubmit}
          >
            <div className="space-y-1">
              <label
                className="text-xxs font-bold text-details-secondary block"
                htmlFor="name"
              >
                Nom
              </label>
              <input
                type="text"
                name="name"
                value={values.name}
                onChange={handleChange}
                className="bg-app-card-secondary border-transparent rounded w-full text-sm font-bold text-black placeholder:text-details-secondary px-4 h-11"
                placeholder="Entrez le nom de votre association"
              />
            </div>

            <div className="space-y-1">
              <label
                className="text-xxs font-bold text-details-secondary block"
                htmlFor="email"
              >
                Email
              </label>
              <input
                type="email"
                name="email"
                value={values.email}
                readOnly
                className="bg-app-card-secondary border-transparent rounded w-full text-sm font-bold text-black placeholder:text-details-secondary px-4 h-11"
              />
            </div>


            <div className="space-y-1">
              <label
                className="text-xxs font-bold text-details-secondary block"
                htmlFor="password"
              >
              Mot de passe
              </label>
              <input
                type="password"
                name="password"
                value={values.password}
                onChange={handleChange}
                className="bg-app-card-secondary border-transparent rounded w-full text-sm font-bold text-black placeholder:text-details-secondary px-4 h-11"
                placeholder="Entrez votre mot de passe"
                required
              />
            </div>

            <div className="space-y-1">
              <label
                className="text-xxs font-bold text-details-secondary block"
                htmlFor="confirmPassword"
              >
              Confirmez votre mot de passe
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={values.confirmPassword}
                onChange={handleChange}
                className="bg-app-card-secondary border-transparent rounded w-full text-sm font-bold text-black placeholder:text-details-secondary px-4 h-11"
                placeholder="Confirmez votre mot de passe"
                required
              />
            </div>

            <button
              type="submit"
              className="w-1/3 col-span-2 text-white font-bold rounded bg-[#4119B5] py-3 px-4"
            >
              Mettre à jour votre compte
            </button>
          </form>
        </section>
      </div>
    </div>

  );
};

export default AccountPage;
