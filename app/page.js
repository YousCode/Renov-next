"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { setUser } from '../redux/reducers/authReducer';

const HomePage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const dispatch = useDispatch();
  
  const user = useSelector((state) => state.Auth.user);

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post('/api/auth/signin', { email, password });
      if (response.data.ok) {
        const { email, name, language, role } = response.data.user;
        dispatch(setUser({ email, name, language, role }));
        router.push('/dashboard');
      } else {
        setError('Invalid email or password');
      }
    } catch (err) {
      setError('Invalid email or password');
    }
  };

  return (
    <div className="relative flex items-center justify-center h-screen">
      <div className="absolute inset-0 bg-overlay opacity-50"></div> {/* Image de fond avec opacité */}
      <div className="relative z-10 flex flex-col items-center">
        <h1 className="text-white mb-6 text-3xl">Login</h1>
        <form onSubmit={handleSubmit} className="flex flex-col w-72 bg-black bg-opacity-80 p-6 rounded-lg">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mb-3 p-2 text-black"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mb-3 p-2 text-black"
          />
          {error && <p className="text-red-500">{error}</p>}
          <button type="submit" className="p-2 bg-blue-500 text-white border-none">Login</button>
        </form>
      </div>
    </div>
  );
};

export default HomePage;
