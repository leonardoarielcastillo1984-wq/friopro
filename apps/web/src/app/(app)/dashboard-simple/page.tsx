'use client';

import { useState } from 'react';
import { Activity } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#333', margin: '0' }}>{greeting}</h1>
          <p style={{ color: '#666', margin: '5px 0 0 0' }}>Resumen ejecutivo de tu sistema de gestión integrado</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px 20px', backgroundColor: '#e3f2fd', border: '1px solid #2196f3', borderRadius: '10px' }}>
          <Activity style={{ color: '#2196f3' }} />
          <div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196f3' }}>SGI 360</div>
            <div style={{ fontSize: '12px', color: '#666' }}>Sistema Operativo</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '10px', border: '1px solid #e0e0e0', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '14px', color: '#666', margin: '0 0 10px 0' }}>📄 Documentos</p>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#333', margin: '0 0 5px 0' }}>0</p>
              <p style={{ fontSize: '12px', color: '#666', margin: '0' }}>0 efectivos, 0 en borrador</p>
            </div>
            <div style={{ width: '50px', height: '50px', backgroundColor: '#e3f2fd', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
              📄
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '10px', border: '1px solid #e0e0e0', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '14px', color: '#666', margin: '0 0 10px 0' }}>📋 Normativos</p>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#333', margin: '0 0 5px 0' }}>0</p>
              <p style={{ fontSize: '12px', color: '#666', margin: '0' }}>0 listos, 0 cláusulas</p>
            </div>
            <div style={{ width: '50px', height: '50px', backgroundColor: '#e8f5e8', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
              📋
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '10px', border: '1px solid #e0e0e0', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '14px', color: '#666', margin: '0 0 10px 0' }}>🏢 Departamentos</p>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#333', margin: '0 0 5px 0' }}>0</p>
              <p style={{ fontSize: '12px', color: '#666', margin: '0' }}>Áreas organizativas</p>
            </div>
            <div style={{ width: '50px', height: '50px', backgroundColor: '#f3e5f5', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
              🏢
            </div>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '10px', border: '1px solid #e0e0e0', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#333', margin: '0 0 20px 0' }}>🎉 Bienvenido a SGI 360</h2>
        <div style={{ color: '#666', lineHeight: '1.6' }}>
          <p style={{ margin: '0 0 20px 0' }}>
            Tu sistema de gestión integrado está funcionando correctamente. 
            Comienza agregando documentos, normativos y configurando tus departamentos.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
            <Link href="/documents" style={{ display: 'inline-flex', alignItems: 'center', padding: '12px 20px', backgroundColor: '#2196f3', color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
              📄 Ver Documentos
            </Link>
            <Link href="/normativos" style={{ display: 'inline-flex', alignItems: 'center', padding: '12px 20px', backgroundColor: '#4caf50', color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
              📋 Ver Normativos
            </Link>
            <Link href="/configuracion" style={{ display: 'inline-flex', alignItems: 'center', padding: '12px 20px', backgroundColor: '#9c27b0', color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
              ⚙️ Configuración
            </Link>
            <a href="/login-final.html" style={{ display: 'inline-flex', alignItems: 'center', padding: '12px 20px', backgroundColor: '#ff9800', color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
              🔄 Logout
            </a>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '10px', textAlign: 'center' }}>
        <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
          <strong>✅ SGI 360 Operativa</strong> - Sistema de Gestión Integrado funcionando correctamente
        </p>
      </div>
    </div>
  );
}
