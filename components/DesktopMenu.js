// components/DesktopMenu.js
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

const DesktopMenu = ({ navMenu }) => {
  const { t } = useTranslation();
  return (
    <ul className="lg:flex hidden items-center gap-6">
      {navMenu.map((item, index) => (
        <li key={index}>
          <Link href={item.path}>
            <span className="text-white font-bold relative px-7 py-5">
              {item.name}
              {item.beta && (
                <span className="align-super text-[#C2A6FF] text-[7px] mb-2">beta</span>
              )}
              <div className="w-full h-0.5 bg-custom-light-green absolute -bottom-[10px] opacity-0 transition-colors" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
};

export default DesktopMenu;
