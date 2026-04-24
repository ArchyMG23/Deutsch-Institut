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
import { auth, db, messaging } from '../firebase';
import { UserProfile } from '../types';
import { toast } from 'sonner';
import { getToken } from 'firebase/messaging';
import { getDeviceInfo } from '../utils';
import i18n from '../i18n/config';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updatedProfile: UserProfile) => void;
  changePassword: (newPassword: string) => Promise<void>;
  validatePassword: (password: string) => { isValid: boolean; message: string };
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
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
    const { t } = i18n;

    if (password.length < minLength) return { isValid: false, message: t('auth.password_too_short') };
    if (!hasUppercase) return { isValid: false, message: t('auth.password_no_uppercase') };
    if (!hasDot) return { isValid: false, message: t('auth.password_no_dot') };
    if (!hasDigit) return { isValid: false, message: t('auth.password_no_digit') };

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
    const handleOnline = () => toast.success(i18n.t('common.online_msg') || 'Vous êtes de nouveau en ligne');
    const handleOffline = () => toast.error(i18n.t('common.offline_msg') || 'Connexion perdue. Vérifiez votre accès internet (Orange/MTN)');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    console.log("AuthProvider: Initializing Auth listener...");
    
    // Safety timeout: force loading to false after 10 seconds if Firebase doesn't respond
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn("AuthProvider: Firebase auth listener timed out. Forcing loading to false.");
        setLoading(false);
      }
    }, 10000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("AuthProvider: Auth state changed:", firebaseUser?.email || "No user");
      clearTimeout(safetyTimeout);
      
      if (firebaseUser) {
        try {
          console.log("AuthProvider: Fetching profile for UID:", firebaseUser.uid);
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const userData = docSnap.data() as UserProfile;
            let fullProfileData = { ...userData };

            // Fetch additional profile data if it's a student or teacher
            if (userData.role === 'student') {
              const studentDoc = await getDoc(doc(db, 'students', firebaseUser.uid));
              if (studentDoc.exists()) {
                fullProfileData = { ...fullProfileData, ...studentDoc.data() };
              }
            } else if (userData.role === 'teacher') {
              const teacherDoc = await getDoc(doc(db, 'teachers', firebaseUser.uid));
              if (teacherDoc.exists()) {
                fullProfileData = { ...fullProfileData, ...teacherDoc.data() };
              }
            }

            const deviceInfo = getDeviceInfo();
            
            // Update status and device info if needed
            if (userData.status !== 'online' || userData.lastActiveDevice !== deviceInfo) {
              await setDoc(doc(db, 'users', firebaseUser.uid), { 
                status: 'online',
                lastActiveDevice: deviceInfo,
                lastLoginAt: serverTimestamp()
              }, { merge: true });
              fullProfileData.status = 'online';
              fullProfileData.lastActiveDevice = deviceInfo;
            }

            console.log("AuthProvider: Profile found:", fullProfileData.role);
            setUser(firebaseUser);
            setProfile(fullProfileData);

            // Register for Push Notifications if supported
            if (messaging && typeof window !== 'undefined') {
              try {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                  const token = await getToken(messaging).catch(e => {
                    console.warn("FCM Token fetch failed:", e);
                    return null;
                  });
                  
                  if (token && userData.fcmToken !== token) {
                    await setDoc(doc(db, 'users', firebaseUser.uid), { fcmToken: token }, { merge: true });
                    console.log("AuthProvider: FCM Token updated");
                  }
                }
              } catch (err) {
                console.warn("AuthProvider: Push permission request error:", err);
              }
            }
          } else {
            console.warn("AuthProvider: User exists in Auth but no Firestore profile found for UID:", firebaseUser.uid);
            console.log("AuthProvider: This might mean the server bootstrap hasn't finished or failed.");
            setUser(firebaseUser);
            setProfile(null);
          }
        } catch (err: any) {
          console.error("AuthProvider: Error fetching user profile:", err.code, err.message);
          setUser(firebaseUser);
          setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      console.log("AuthProvider: Loading complete.");
      setLoading(false);
    }, (error) => {
      console.error("AuthProvider: onAuthStateChanged error:", (error as any).code, error.message);
      clearTimeout(safetyTimeout);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      clearTimeout(safetyTimeout);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const login = async (identifier: string, password: string) => {
    const { t } = i18n;
    let email = identifier.trim();
    
    // If identifier is not an email, assume it's a matricule and look up the email via backend
    if (!email.includes('@')) {
      console.log("Looking up email for matricule via backend:", email);
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matricule: email, password: 'dummy' }) // password not checked here
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(t('auth.invalid_matricule'));
          }
          throw new Error(t('auth.matricule_lookup_error'));
        }
        
        const data = await response.json();
        email = data.user.email;
      } catch (err: any) {
        console.error("Matricule lookup error:", err);
        throw err;
      }
    }

    try {
      console.log("Attempting Firebase login for:", email);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("Firebase login error:", err.code, err.message);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        throw new Error(t('auth.invalid_credentials'));
      }
      if (err.code === 'auth/operation-not-allowed') {
        throw new Error(t('auth.firebase_not_enabled'));
      }
      if (err.code === 'auth/too-many-requests') {
        throw new Error(t('auth.too_many_requests'));
      }
      throw new Error(err.message || t('auth.login_error'));
    }
  };

  const logout = async () => {
    try {
      if (auth.currentUser) {
        await setDoc(doc(db, 'users', auth.currentUser.uid), { 
          status: 'offline',
          lastActiveDevice: 'Déconnecté' 
        }, { merge: true });
      }
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

  const fetchWithAuth = React.useCallback(async (url: string, options: RequestInit = {}) => {
    if (!auth.currentUser) {
      toast.error('Session expirée. Veuillez vous reconnecter.');
      throw new Error('Non authentifié');
    }
    const token = await auth.currentUser.getIdToken();
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
    
    try {
      const response = await fetch(url, { ...options, headers });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.message || `Erreur ${response.status}: ${response.statusText}`;
        toast.error(message);
      }
      return response;
    } catch (err: any) {
      toast.error("Erreur réseau ou serveur. Veuillez réessayer.");
      throw err;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, updateProfile, changePassword, validatePassword, fetchWithAuth }}>
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
