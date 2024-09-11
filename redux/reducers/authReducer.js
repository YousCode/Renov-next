const initialState = {
  user: null,
};

// Action types
const SET_USER = 'SET_USER';
const LOGOUT_USER = 'LOGOUT_USER';

// Action creators
export const setUser = (user) => ({
  type: SET_USER,
  payload: {
    email: user.email,
    name: user.name,
    language: user.language,
    role: user.role // Ajoutez le rôle ici
  },
});

export const logoutUser = () => ({
  type: LOGOUT_USER,
});

export default function authReducer(state = initialState, action) {
  switch (action.type) {
    case SET_USER:
// console.log("Setting user:", action.payload);

      return { ...state, user: action.payload };
    case LOGOUT_USER:
      return { ...state, user: null };
    default:
      return state;
  }
}
