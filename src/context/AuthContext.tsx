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
    const bootstrapAdmin = async () => {
      const adminEmail = 'yombivictor@gmail.com';
      const adminPass = 'Admin.1234';
      
      try {
        // Instead of querying Firestore (which requires auth), 
        // we try to create the Auth user directly.
        // If they exist, Auth will throw 'auth/email-already-in-use'.
        console.log("Attempting to bootstrap super admin...");
        const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPass);
        const uid = userCredential.user.uid;
        
        const adminProfile: UserProfile = {
          uid,
          matricule: 'SUPERADMIN',
          email: adminEmail,
          role: 'admin',
          firstName: 'Victor',
          lastName: 'Yombi',
          status: 'online',
          createdAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'users', uid), adminProfile);
        console.log("Super admin bootstrapped successfully.");
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          // Admin already exists in Auth, check if Firestore profile exists
          // This part will run after the user is potentially logged in or if we just ignore it
          // since if they exist in Auth, they likely have a profile or will get one on login.
          console.log("Admin already exists in Auth.");
        } else {
          console.error("Failed to bootstrap admin:", err);
        }
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const userData = docSnap.data() as UserProfile;
            setUser(userData);
            setProfile(userData);
          } else {
            // User exists in Auth but not in Firestore
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

    bootstrapAdmin();
    return () => unsubscribe();
  }, []);

  const login = async (identifier: string, password: string) => {
    let email = identifier;
    
    // If identifier is not an email, assume it's a matricule and look up the email
    if (!identifier.includes('@')) {
      const q = query(collection(db, 'users'), where('matricule', '==', identifier));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        throw new Error('Matricule non trouvé.');
      }
      
      email = querySnapshot.docs[0].data().email;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        throw new Error('Identifiants incorrects.');
      }
      throw new Error(err.message || 'Erreur de connexion');
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
