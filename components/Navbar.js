"use client";
import { Fragment, useState } from "react";
import { Menu, Transition } from "@headlessui/react";
import Link from "next/link";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

export const Navbar = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navMenu = [
    { name: "Acceuil", path: "/dashboard" },
    { name: "Chercher Clients", path: "/explorer", beta: true },
    { name: "Statistiques", path: "/statistics" },
  ];

  async function logout() {
    try {
      await axios.post('/api/auth/logout');
      dispatch(logoutUser());
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  return (
    <nav className="bg-gradient-to-r from-[#7db86e] to-[#7db86e] font-garamond">
      <div className="container  flex items-center justify-between py-4 px-6 lg:px-12">
        {/* Mobile Menu Button */}
        <div className="lg:hidden flex items-center">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-white focus:outline-none"
          >
            {mobileMenuOpen ? (
              <XMarkIcon className="h-6 w-6" />
            ) : (
              <Bars3Icon className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <div className="hidden lg:flex items-center space-x-4">
          {navMenu.map((item, index) => (
            <Link key={index} href={item.path}>
              <span className="text-lg text-white hover:text-gray-300 cursor-pointer">
                {item.name}
              </span>
            </Link>
          ))}
        </div>

        {/* Logo */}
        <div className="flex items-center justify-center ">
          <img
            src="/logo.png"
            alt="Logo"
            className="h-12 mr-20 pr-10"
          />
        </div>

        {/* User Menu */}
        <div className="hidden lg:flex items-center space-x-4">
          <Menu as="div" className="relative inline-block text-left z-50">
            <div>
              <Menu.Button className="w-9 h-9 rounded-full flex items-center justify-center">
                <img
                  src="/avatar.png"
                  className="w-9 h-9 rounded-full"
                  alt="Avatar"
                />
              </Menu.Button>
            </div>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 mt-2 w-32 origin-top-right divide-y divide-gray-100 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none bg-green-500">
                <div className="px-1 py-1">
                  <Menu.Item>
                    {({ active }) => (
                      <Link href="/account" className={`${active ? "bg-green-700" : ""} group flex w-full items-center rounded-md px-2 py-1 text-white transition-colors text-sm font-semibold`}>
                        {t("menu.account")}
                      </Link>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button className={`${active ? "bg-green-700" : ""} group flex w-full items-center rounded-md px-2 py-1 text-white transition-colors text-sm font-semibold`} onClick={logout}>
                        {t("menu.sign_out")}
                      </button>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </div>

      {/* Mobile Menu */}
      <Transition
        show={mobileMenuOpen}
        enter="transition ease-out duration-200"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <div className="lg:hidden">
          <div className="flex flex-col items-center space-y-4 bg-green-500 py-4">
            {navMenu.map((item, index) => (
              <Link key={index} href={item.path}>
                <span className="text-lg text-white hover:text-gray-200 cursor-pointer">
                  {item.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </Transition>
    </nav>
  );
};

export default Navbar;