
import Link from 'next/link';

interface ActionProject {
  id: string;
  code: string;
  name: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  progress: number;
  responsible?: {
    name: string;
  };
}

// Board Card Component for Kanban
export function BoardCard({ project }: { project: ActionProject }) {
  return (
    <Link href={`/project360/${project.id}`}>
      <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-2 h-2 rounded-full ${
            project.priority === 'CRITICAL' ? 'bg-red-500' :
            project.priority === 'HIGH' ? 'bg-orange-500' :
            project.priority === 'MEDIUM' ? 'bg-yellow-500' : 'bg-blue-500'
          }`} />
          <span className="text-xs text-gray-500">{project.code}</span>
        </div>
        <h5 className="font-medium text-sm text-gray-900 mb-1 line-clamp-2">{project.name}</h5>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{project.responsible?.name || 'Sin responsable'}</span>
          <span>{project.progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
          <div 
            className="bg-blue-500 h-1 rounded-full transition-all" 
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>
    </Link>
  );
}
