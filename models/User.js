/**
 * User Model
 * Stores user credentials and personalization data for the recommendation system.
 * bookmarks & readingHistory feed into the DeepCARSKit engine later.
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Sub-schema for bookmarked articles
const bookmarkSchema = new mongoose.Schema(
  {
    articleId: { type: String, required: true },
    title: { type: String, default: "" },
    category: { type: String, default: "general" },
    url: String,
    bookmarkedAt: { type: Date, default: Date.now },
   
  },
  { _id: false },
);

// Sub-schema for reading history (context for recommendations)
const historySchema = new mongoose.Schema(
  {
    articleId: { type: String, required: true },
    title: { type: String, default: "" },
    category: { type: String, default: "general" },

timeContext: {
  type: String,
  default: "unknown",
},

readAt: { type: Date, default: Date.now },
    dwellTimeSeconds: { type: Number, default: 0 },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Never return password in queries by default
    },
    bookmarks: {
      type: [bookmarkSchema],
      default: [],
    },
    readingHistory: {
      type: [historySchema],
      default: [],
    },
    preferredCategories: {
      type: [String],
      default: [],
      // e.g. ['technology', 'sports', 'health']
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false, // We use createdAt explicitly
  },
);

/**
 * Hash password before saving (only when password is modified)
 */
// Mongoose 9: async pre-hook — do not use next(); return when skipping
userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Compare plain-text password with hashed password in DB
 */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
