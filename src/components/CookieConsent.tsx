import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Cookies from 'js-cookie';
import { useTranslation } from 'react-i18next';
import { Cookie, X } from 'lucide-react';

const CookieConsent = () => {
  const [isVisible, setIsVisible] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const consent = Cookies.get('cookie-consent');
    if (!consent) {
      // Small delay before showing the banner
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    Cookies.set('cookie-consent', 'accepted', { expires: 365 });
    setIsVisible(false);
  };

  const handleDecline = () => {
    Cookies.set('cookie-consent', 'declined', { expires: 7 });
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-6 right-6 md:left-auto md:right-8 md:max-w-md z-[9999]"
        >
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl rounded-3xl p-6 relative overflow-hidden group">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-dia-red/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-700" />
            
            <div className="relative flex items-start gap-4">
              <div className="bg-dia-red/10 p-3 rounded-2xl text-dia-red">
                <Cookie size={24} />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black uppercase tracking-widest text-neutral-900 dark:text-white">
                    {t('common.cookies_title')}
                  </h3>
                  <button 
                    onClick={() => setIsVisible(false)}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
                
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mb-6">
                  {t('common.cookies_message')}
                </p>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleAccept}
                    className="flex-1 bg-dia-red text-white py-3 rounded-2xl text-xs font-bold uppercase transition-all hover:bg-dia-red-dark hover:shadow-lg hover:shadow-dia-red/20 active:scale-95"
                  >
                    {t('common.accept_cookies')}
                  </button>
                  <button
                    onClick={handleDecline}
                    className="flex-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 py-3 rounded-2xl text-xs font-bold uppercase transition-all hover:bg-neutral-200 dark:hover:bg-neutral-700 active:scale-95"
                  >
                    {t('common.decline_cookies')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieConsent;
