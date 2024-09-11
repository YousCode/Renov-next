import { combineReducers } from '@reduxjs/toolkit';
import authReducer from './authReducer'; // Assurez-vous d'avoir un réducteur authReducer

const rootReducer = combineReducers({
  Auth: authReducer,
});

export default rootReducer;
// console.log("Setting user:", action.payload);
