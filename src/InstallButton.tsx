import React, { useEffect, useState } from 'react';

const InstallButton: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handler = (e: any) => {
            // Prevenir que Chrome muestre el aviso automático (queremos controlarlo nosotros)
            e.preventDefault();
            // Guardar el evento para dispararlo cuando el usuario haga click
            setDeferredPrompt(e);
            // Mostrar nuestro botón
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        // Mostrar el diálogo de instalación nativo
        deferredPrompt.prompt();

        // Esperar a ver qué decide el usuario
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('Usuario aceptó instalar');
            setIsVisible(false); // Ocultar botón si ya instaló
        }
        
        setDeferredPrompt(null);
    };

    // Si el navegador no soporta instalación o ya está instalada, no mostramos nada
    if (!isVisible) return null;

    return (
        <button 
            onClick={handleInstallClick}
            className="btn animate-pulse"
            style={{
                background: 'linear-gradient(90deg, #ec4899 0%, #8b5cf6 100%)',
                color: 'white',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '20px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                fontSize: '0.8rem',
                marginRight: '10px'
            }}
        >
            📲 Instalar App
        </button>
    );
};

export default InstallButton;