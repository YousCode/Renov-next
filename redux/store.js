import { configureStore } from '@reduxjs/toolkit';
import authReducer from './reducers/authReducer'; 

const store = configureStore({
  reducer: {
    Auth: authReducer,
  },
});

export default store;
