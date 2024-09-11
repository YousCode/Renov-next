// hooks/useAuth.js
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';

const useAuth = () => {
  const user = useSelector((state) => state.Auth.user);
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/dashboard'); // Redirige vers le tableau de bord si l'utilisateur est connecté
    }
  }, [user, router]);

  return user;
};

export default useAuth;
