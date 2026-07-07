// models/user.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  email: { type: String, required: true, unique: true, trim: true },
  workspace_id: { type: String },
  workspace_name: { type: String },
  avatar: { type: String, default: "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y" },
  password: String,
  status: { type: String, enum: ["PENDING", "ACCEPTED", "REFUSED"], default: "PENDING" },
  invitation_token: { type: String },
  invitation_expires: { type: Date },
  forgot_password_reset_token: { type: String },
  forgot_password_reset_expires: { type: Date },
  role: { type: String, enum: ["admin", "normal"], default: "normal" },
  language: { type: String, enum: ["fr", "en"], default: "fr" },
  last_login_at: { type: Date, default: Date.now },
  registered_at: { type: Date },
  created_at: { type: Date, default: Date.now },
});

userSchema.pre("save", function(next) {
  // les utilisateurs invités n'ont pas encore de mot de passe : ne pas hasher undefined
  if ((this.isModified("password") || this.isNew) && this.password) {
    bcrypt.hash(this.password, 10, (e, hash) => {
      if (e) return next(e);
      this.password = hash;
      return next();
    });
  } else {
    return next();
  }
});

userSchema.methods.comparePassword = function(password) {
  // utilisateur invité sans mot de passe défini : refuser au lieu de crasher
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(password, this.password);
};

export default mongoose.models.User || mongoose.model("User", userSchema);
