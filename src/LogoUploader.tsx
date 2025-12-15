import React, { useState } from 'react';
import { db, storage } from './firebase'; // Asegúrate de que 'storage' esté importado en firebase.ts
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';

interface LogoUploaderProps {
    forma21Id: string;
    currentLogoUrl?: string;
    onUpload: () => void;
}

const LogoUploader: React.FC<LogoUploaderProps> = ({ forma21Id, currentLogoUrl, onUpload }) => {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setProgress(0);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            alert("Por favor, selecciona un archivo (PNG o JPG).");
            return;
        }

        setLoading(true);
        try {
            // 1. Subir a Firebase Storage
            const storageRef = ref(storage, `logos/${forma21Id}_${file.name}`);
            
            // Nota: Aquí se usa 'uploadBytes' que es simple. Para progreso real, usarías 'uploadBytesResumable'.
            await uploadBytes(storageRef, file); 

            // 2. Obtener URL pública
            const downloadURL = await getDownloadURL(storageRef);

            // 3. Actualizar Firestore (en la colección 'equipos' y 'forma21s')
            const forma21Ref = doc(db, 'forma21s', forma21Id);
            const equipoRef = doc(db, 'equipos', forma21Id); // Ya que el ID del equipo es el ID de la forma21

            await updateDoc(forma21Ref, { logoUrl: downloadURL });
            await updateDoc(equipoRef, { logoUrl: downloadURL });

            alert("✅ Logo subido y registrado con éxito.");
            setFile(null);
            onUpload(); // Llama a refreshData en el dashboard
            
        } catch (error) {
            console.error("Error al subir el logo:", error);
            alert("Error al subir el logo. Revisa la consola.");
        } finally {
            setLoading(false);
        }
    };
    
    // Si no tienes configurado Firebase Storage, este es el momento:
    useEffect(() => {
        if (!storage) {
             console.warn("⚠️ Firebase Storage no está configurado o importado correctamente.");
        }
    }, []);


    return (
        <div style={{ padding: '5px', border: '1px dashed #ccc', borderRadius: '4px', background: '#f9f9f9', marginTop: '10px' }}>
            <h4 style={{ margin: '5px 0', fontSize: '0.9rem', color: '#374151' }}>{currentLogoUrl ? 'Cambiar Logo' : 'Subir Logo Oficial'}</h4>
            
            <input 
                type="file" 
                accept="image/png, image/jpeg" 
                onChange={handleFileChange} 
                style={{ fontSize: '0.8rem', width: 'calc(100% - 80px)' }}
            />
            
            <button 
                onClick={handleUpload} 
                disabled={loading || !file}
                className="btn btn-primary"
                style={{ float: 'right', padding: '6px 10px', fontSize: '0.7rem', width:'70px' }}
            >
                {loading ? '...' : 'Subir'}
            </button>
            
            {loading && <p style={{ fontSize: '0.7rem', color: 'blue', margin: '5px 0 0 0' }}>Cargando: {progress}%</p>}
            
            {currentLogoUrl && (
                <div style={{ marginTop: '5px', fontSize: '0.7rem', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Logo actual cargado.
                </div>
            )}
        </div>
    );
};

export default LogoUploader;