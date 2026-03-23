import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut,
  createUserWithEmailAndPassword,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updatedProfile: UserProfile) => void;
  changePassword: (newPassword: string) => Promise<void>;
  validatePassword: (password: string) => { isValid: boolean; message: string };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const validatePassword = (password: string) => {
    const minLength = 6;
    const hasUppercase = /[A-Z]/.test(password);
    const hasDot = /\./.test(password);
    const hasDigit = /\d/.test(password);

    if (password.length < minLength) return { isValid: false, message: "Le mot de passe doit contenir au moins 6 caractères." };
    if (!hasUppercase) return { isValid: false, message: "Le mot de passe doit contenir au moins une majuscule." };
    if (!hasDot) return { isValid: false, message: "Le mot de passe doit contenir au moins un point (.)." };
    if (!hasDigit) return { isValid: false, message: "Le mot de passe doit contenir au moins un chiffre." };

    return { isValid: true, message: "" };
  };

  const updateProfile = async (updatedProfile: UserProfile) => {
    if (auth.currentUser) {
      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        ...updatedProfile,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setProfile(updatedProfile);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("Auth state changed:", firebaseUser?.email);
      if (firebaseUser) {
        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const userData = docSnap.data() as UserProfile;
            setUser(firebaseUser);
            setProfile(userData);
          } else {
            console.warn("User exists in Auth but no Firestore profile found for UID:", firebaseUser.uid);
            setUser(firebaseUser);
            setProfile(null);
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
          setUser(firebaseUser);
          setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (identifier: string, password: string) => {
    let email = identifier.trim();
    
    // If identifier is not an email, assume it's a matricule and look up the email
    if (!email.includes('@')) {
      console.log("Looking up email for matricule:", email);
      const q = query(collection(db, 'users'), where('matricule', '==', email.toUpperCase()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        throw new Error('Matricule non trouvé. Veuillez vérifier votre code.');
      }
      
      email = querySnapshot.docs[0].data().email;
    }

    try {
      console.log("Attempting Firebase login for:", email);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("Firebase login error:", err.code, err.message);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        throw new Error('Identifiants incorrects. Veuillez vérifier votre email/matricule et mot de passe.');
      }
      throw new Error(err.message || 'Erreur de connexion au serveur d\'authentification.');
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      window.location.href = '/login';
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const changePassword = async (newPassword: string) => {
    if (auth.currentUser) {
      const validation = validatePassword(newPassword);
      if (!validation.isValid) {
        throw new Error(validation.message);
      }
      
      try {
        const { updatePassword } = await import('firebase/auth');
        await updatePassword(auth.currentUser, newPassword);
      } catch (err: any) {
        if (err.code === 'auth/requires-recent-login') {
          throw new Error("Cette opération est sensible et nécessite une authentification récente. Veuillez vous reconnecter et réessayer.");
        }
        throw new Error(err.message || "Erreur lors du changement de mot de passe.");
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, updateProfile, changePassword, validatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
