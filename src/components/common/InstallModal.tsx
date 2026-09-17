import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface InstallModalProps {
  deferredPrompt: any;
  onClose: () => void;
}

export const InstallModal: React.FC<InstallModalProps> = ({ deferredPrompt, onClose }) => {
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // إظهار نافذة تثبيت الـ PWA الرسمية الخاصة بالمتصفح
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('تم تثبيت التطبيق بنجاح');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl relative border border-emerald-100">
        <button 
          onClick={onClose}
          className="absolute top-3 left-3 text-gray-400 hover:text-gray-600 p-1 rounded-full"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Download className="w-8 h-8" />
        </div>

        <h3 className="text-xl font-bold text-gray-900 mb-2">تثبيت تطبيق شَهْم</h3>
        <p className="text-gray-600 text-sm mb-6 leading-relaxed">
          قم بتثبيت التطبيق على شاشة هاتفك الرئيسية للوصول السريع، وتلقي الإشعارات، والعمل بدون إنترنت.
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleInstallClick}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition duration-200 flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            تثبيت التطبيق الآن
          </button>
          
          <button
            onClick={onClose}
            className="w-full text-gray-500 hover:text-gray-700 text-sm py-2"
          >
            المتابعة عبر المتصفح
          </button>
        </div>
      </div>
    </div>
  );
};
