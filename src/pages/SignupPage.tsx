import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/services/apiClient";
import { useAuthStore } from "@/store/authStore";
import { auth, db } from "@/services/firebase";
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser, setAccessToken } = useAuthStore();

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCred = await signInWithPopup(auth, provider);
      const idToken = await userCred.user.getIdToken();

      // Ensure Firestore User Document exists without overwriting existing user data
      const userDocRef = doc(db, "users", userCred.user.uid);
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists()) {
        await setDoc(userDocRef, {
          id: userCred.user.uid,
          email: userCred.user.email,
          name: userCred.user.displayName || userCred.user.email?.split("@")[0] || "Google Reader",
          role: "USER",
          createdAt: new Date().toISOString(),
        }, { merge: true });
      }

      // Backend API sync
      const { data } = await api.post("/auth/firebase-sync", { idToken });
      setUser(data.user);
      setAccessToken(data.accessToken);
      navigate("/onboarding"); // After signup with Google, we go to onboarding as well
    } catch (e: any) {
      console.error("[Google Auth Error]", e);
      const code = e?.code || "";
      const msg = e?.response?.data?.message || e?.message || "";
      if (code === "auth/popup-closed-by-user") {
        setError("Sign-in popup closed. Please try again.");
      } else if (code === "auth/operation-not-allowed" || msg.includes("operation-not-allowed")) {
        setError("firebase-google-disabled");
      } else if (code === "auth/unauthorized-domain" || msg.includes("unauthorized-domain")) {
        setError("firebase-unauthorized-domain");
      } else {
        setError(msg || "Google Sign-In failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (loading) return;
    setError("");

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanName || !cleanEmail || !cleanPassword) {
      setError("All fields are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (cleanPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      // 1. Firebase Authentication
      const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      await updateProfile(userCred.user, { displayName: cleanName });
      const idToken = await userCred.user.getIdToken();

      // 2. Firestore User Document Creation (safely handling duplicates via doc check + merge)
      const userDocRef = doc(db, "users", userCred.user.uid);
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists()) {
        await setDoc(userDocRef, {
          id: userCred.user.uid,
          email: cleanEmail,
          name: cleanName,
          role: "USER",
          createdAt: new Date().toISOString(),
        }, { merge: true });
      }

      // 3. Backend API sync
      const { data } = await api.post("/auth/firebase-sync", { idToken });
      setUser(data.user);
      setAccessToken(data.accessToken);
      navigate("/onboarding");
    } catch (e: any) {
      const code = e?.code || "";
      const msg = e?.response?.data?.message || e?.message || "";

      if (code) {
        console.error(`[Firebase Auth Error] code: ${code}, message: ${e.message}`);
      } else {
        console.error(`[Signup Error] code: ${code || "UNKNOWN"}, message: ${msg}`);
      }

      if (code === "auth/operation-not-allowed" || msg.includes("operation-not-allowed")) {
        setError("firebase-email-disabled");
      } else if (
        code === "auth/email-already-in-use" ||
        msg.toLowerCase().includes("already exists") ||
        e?.response?.status === 409
      ) {
        setError("An account already exists with this email. Please log in instead.");
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else if (code === "auth/invalid-email") {
        setError("The email address format is invalid.");
      } else if (code === "auth/weak-password") {
        setError("Password is too weak. Please use at least 6 characters.");
      } else if (code === "auth/network-request-failed") {
        setError("Network connection error. Please check your internet connection.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else {
        setError(e?.response?.data?.errors?.[0]?.message || msg || "Signup failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-6">
      <div className="bg-white rounded-2xl border border-[#DCEEFA] shadow-sm p-9 w-full max-w-sm">
        <h2 className="font-display text-2xl font-bold text-center mb-1">Create your account</h2>
        <p className="text-textmuted text-sm text-center mb-6">Start your reading journey today</p>
        
        {error === "firebase-email-disabled" && (
          <div className="text-left text-xs mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl space-y-2">
            <p className="font-bold text-amber-800">⚠️ Firebase Email Provider Disabled</p>
            <p>Your Firebase project has not enabled the <strong>Email/Password</strong> sign-in method.</p>
            <p className="font-semibold mt-1">How to enable:</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Open the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="underline font-bold text-amber-700 hover:text-amber-800">Firebase Console</a></li>
              <li>Go to <strong>Build</strong> &gt; <strong>Authentication</strong></li>
              <li>Click the <strong>Sign-in method</strong> tab</li>
              <li>Click <strong>Add new provider</strong> and choose <strong>Email/Password</strong></li>
              <li>Toggle it to <strong>Enable</strong> and click <strong>Save</strong></li>
            </ol>
          </div>
        )}

        {error === "firebase-google-disabled" && (
          <div className="text-left text-xs mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl space-y-2">
            <p className="font-bold text-amber-800">⚠️ Firebase Google Provider Disabled</p>
            <p>Your Firebase project has not enabled the <strong>Google</strong> sign-in method.</p>
            <p className="font-semibold mt-1">How to enable:</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Open the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="underline font-bold text-amber-700 hover:text-amber-800">Firebase Console</a></li>
              <li>Go to <strong>Build</strong> &gt; <strong>Authentication</strong></li>
              <li>Click the <strong>Sign-in method</strong> tab</li>
              <li>Click <strong>Add new provider</strong> and choose <strong>Google</strong></li>
              <li>Toggle it to <strong>Enable</strong>, select a support email, and click <strong>Save</strong></li>
            </ol>
          </div>
        )}

        {error === "firebase-unauthorized-domain" && (
          <div className="text-left text-xs mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl space-y-2">
            <p className="font-bold text-amber-800">⚠️ Unauthorized Domain Error</p>
            <p>Your Firebase project has not authorized this domain for Authentication.</p>
            <p className="font-semibold mt-1">To fix this, add the following domain to your Firebase authorized domains list:</p>
            <div className="bg-amber-100 p-2 rounded font-mono text-[10px] break-all select-all font-bold text-center">
              {window.location.hostname}
            </div>
            <p className="font-semibold mt-1">How to enable:</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Open the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="underline font-bold text-amber-700 hover:text-amber-800">Firebase Console</a></li>
              <li>Go to <strong>Build</strong> &gt; <strong>Authentication</strong></li>
              <li>Click the <strong>Settings</strong> tab at the top</li>
              <li>Under <strong>Authorized domains</strong>, click <strong>Add domain</strong></li>
              <li>Paste the domain shown above (<code>{window.location.hostname}</code>) and click <strong>Add</strong></li>
            </ol>
          </div>
        )}

        {error && error !== "firebase-email-disabled" && error !== "firebase-google-disabled" && error !== "firebase-unauthorized-domain" && (
          <p className="text-error text-xs mb-3 p-2 bg-error/10 rounded-lg">{error}</p>
        )}
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name"
          className="w-full px-4 py-3 rounded-xl border border-[#DCEEFA] text-sm mb-3 outline-none focus:border-primary" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address"
          className="w-full px-4 py-3 rounded-xl border border-[#DCEEFA] text-sm mb-3 outline-none focus:border-primary" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password"
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-full px-4 py-3 rounded-xl border border-[#DCEEFA] text-sm mb-5 outline-none focus:border-primary" />
        <button onClick={submit} disabled={loading} className="w-full bg-ocean text-white rounded-xl py-3 font-bold mb-4 disabled:opacity-60 transition-opacity">
          {loading ? "Creating account…" : "Create account"}
        </button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[#DCEEFA]" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-textmuted">Or continue with</span>
          </div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          type="button"
          className="w-full border border-[#DCEEFA] hover:bg-slate-50 text-slate-700 rounded-xl py-3 font-bold mb-4 flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.9h6.6c-.28 1.5-.1.1.09 1.1-1.09 2.1-3.1 3.5-5.69 3.5-3.5 0-6.49-2.3-7.55-5.5a7.48 7.48 0 0 1 0-4.4c1.06-3.2 4.05-5.5 7.55-5.5 1.9 0 3.7.7 5.1 2l3.8-3.8c-2.4-2.2-5.5-3.6-8.9-3.6C5.5 1 1 5.5 1 12s4.5 11 11 11c6.5 0 11.75-5.5 11.75-11.73z"
            />
          </svg>
          Google
        </button>

        <p className="text-center text-sm text-textmuted">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-semibold">Log in</Link>
        </p>
      </div>
    </div>
  );
}
