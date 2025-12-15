import React, { useState } from 'react';
import { storage } from './firebase'; // Importamos solo storage
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface LogoUploaderProps {
    currentUrl?: string; // Para mostrar la imagen actual si existe
    onUploadSuccess: (url: string) => void; // Función para devolver la URL al padre
}

const LogoUploader: React.FC<LogoUploaderProps> = ({ currentUrl, onUploadSuccess }) => {
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState(currentUrl || "https://cdn-icons-png.flaticon.com/512/166/166344.png");

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 1. Validaciones básicas
        if (!file.type.startsWith('image/')) {
            alert('Por favor selecciona un archivo de imagen válido (JPG, PNG).');
            return;
        }
        
        // Max 2MB
        if (file.size > 2 * 1024 * 1024) {
            alert('La imagen es muy pesada. Intenta con una menor a 2MB.');
            return;
        }

        setUploading(true);

        try {
            // 2. Crear referencia única en Firebase Storage
            // Usamos Date.now() para evitar nombres duplicados
            const storageRef = ref(storage, `logos/${Date.now()}_${file.name}`);
            
            // 3. Subir el archivo
            await uploadBytes(storageRef, file);
            
            // 4. Obtener la URL pública
            const url = await getDownloadURL(storageRef);
            
            // 5. Actualizar vista previa y avisar al componente padre
            setPreview(url);
            onUploadSuccess(url);

        } catch (error) {
            console.error("Error subiendo imagen:", error);
            alert("Error al subir la imagen. Intenta de nuevo.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'10px'}}>
            {/* VISTA PREVIA CIRCULAR */}
            <div style={{
                width:'100px', height:'100px', borderRadius:'50%', 
                border:'4px solid #e5e7eb', overflow:'hidden', position:'relative',
                background:'#f9fafb', display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow:'0 4px 6px rgba(0,0,0,0.1)'
            }}>
                <img 
                    src={preview} 
                    alt="Logo Preview" 
                    style={{width:'100%', height:'100%', objectFit:'cover', opacity: uploading ? 0.5 : 1}}
                />
                
                {/* INDICADOR DE CARGA */}
                {uploading && (
                    <div style={{
                        position:'absolute', top:0, left:0, right:0, bottom:0,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        background:'rgba(255,255,255,0.7)', fontWeight:'bold', fontSize:'0.8rem', color:'#333'
                    }}>
                        Subiendo...
                    </div>
                )}
            </div>

            {/* BOTÓN INPUT OCULTO ESTILIZADO */}
            <label className="btn btn-secondary" style={{cursor: uploading ? 'not-allowed' : 'pointer', fontSize:'0.9rem', padding:'8px 15px', display:'inline-block'}}>
                {uploading ? '⏳ Espere...' : '📷 Seleccionar Imagen'}
                <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange} 
                    style={{display:'none'}} 
                    disabled={uploading}
                />
            </label>
        </div>
    );
};

export default LogoUploader;