'use client';

import { useState } from 'react';

export default function ProjectsPage() {
  const [projects] = useState([]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">Proyectos</h1>
      <p className="text-gray-600">Gestión de proyectos y portafolio</p>
      {projects.length === 0 && (
        <p className="text-gray-600 mt-4">No hay proyectos disponibles</p>
      )}
    </div>
  );
}
