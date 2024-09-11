// app/ReduxProvider.js

"use client";

import { Provider } from 'react-redux';
import store from '../redux/store'; // Assurez-vous que le chemin est correct

export default function ReduxProvider({ children }) {
  return (
    <Provider store={store}>
      {children}
    </Provider>
  );
}
