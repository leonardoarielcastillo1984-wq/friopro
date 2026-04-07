'use client';

import React, { useState, useEffect } from 'react';
import {
  Globe, Key, Copy, RefreshCw, Plus, X, Edit, Trash2, Eye, EyeOff,
  CheckCircle2, AlertCircle, Play, Pause, Settings, Shield, Database,
  Code, FileText, Users, Clock, BarChart3, Zap, Lock, Unlock
} from 'lucide-react';

interface APIEndpoint {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  parameters: Array<{
    name: string;
    type: 'query' | 'path' | 'body';
    required: boolean;
    dataType: string;
    description: string;
  }>;
  responses: Array<{
    code: number;
    description: string;
    schema?: any;
  }>;
  authentication: boolean;
  rateLimit?: {
    requests: number;
    window: string;
  };
  examples?: Array<{
    name: string;
    request: any;
    response: any;
  }>;
}

interface APIKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  enabled: boolean;
  expiresAt?: string;
  lastUsed?: string;
  usageCount: number;
  createdAt: string;
  createdBy?: string;
}

interface APIUsage {
  date: string;
  requests: number;
  errors: number;
  responseTime: number;
  endpoints: Array<{
    path: string;
    count: number;
    avgResponseTime: number;
  }>;
}

interface ExternalAPIProps {
  endpoints: APIEndpoint[];
  apiKeys: APIKey[];
  usage: APIUsage[];
  onAPIKeyCreate?: (key: Partial<APIKey>) => void;
  onAPIKeyUpdate?: (key: APIKey) => void;
  onAPIKeyDelete?: (keyId: string) => void;
  onAPIKeyToggle?: (keyId: string, enabled: boolean) => void;
  onEndpointTest?: (endpointId: string, params: any) => void;
  className?: string;
}

const METHOD_COLORS = {
  GET: '#10B981',
  POST: '#3B82F6',
  PUT: '#F59E0B',
  DELETE: '#EF4444',
  PATCH: '#8B5CF6'
};

export default function ExternalAPI({
  endpoints,
  apiKeys,
  usage,
  onAPIKeyCreate,
  onAPIKeyUpdate,
  onAPIKeyDelete,
  onAPIKeyToggle,
  onEndpointTest,
  className = ''
}: ExternalAPIProps) {
  const [showCreateKeyForm, setShowCreateKeyForm] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null);
  const [selectedKey, setSelectedKey] = useState<APIKey | null>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [showAPIKeys, setShowAPIKeys] = useState(false);

  const activeKeys = apiKeys.filter(key => key.enabled);
  const totalRequests = usage.reduce((sum, day) => sum + day.requests, 0);
  const totalErrors = usage.reduce((sum, day) => sum + day.errors, 0);
  const avgResponseTime = usage.length > 0 
    ? usage.reduce((sum, day) => sum + day.responseTime, 0) / usage.length 
    : 0;

  const handleCreateAPIKey = (keyData: Partial<APIKey>) => {
    const newKey: APIKey = {
      id: `key-${Date.now()}`,
      name: keyData.name || 'Nueva API Key',
      key: `sgi_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`,
      permissions: keyData.permissions || ['read'],
      enabled: true,
      usageCount: 0,
      createdAt: new Date().toISOString()
    };

    onAPIKeyCreate?.(newKey);
    setShowCreateKeyForm(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const testEndpoint = async (endpoint: APIEndpoint, params: any = {}) => {
    try {
      // Simulate API call
      const response = await fetch(`/api/external${endpoint.path}`, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKeys[0]?.key || ''}`
        },
        ...(endpoint.method !== 'GET' && { body: JSON.stringify(params) })
      });

      const result = await response.json();
      setTestResults({
        success: response.ok,
        status: response.status,
        data: result,
        responseTime: Math.random() * 1000 // Simulated response time
      });
    } catch (error: any) {
      setTestResults({
        success: false,
        error: error?.message || 'Unknown error',
        responseTime: Math.random() * 1000
      });
    }
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <Globe className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">API Externa</h3>
            <p className="text-sm text-gray-600 mt-1">
              {endpoints.length} endpoints • {activeKeys.length} keys activas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAPIKeys(!showAPIKeys)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Key className="w-4 h-4" />
            API Keys
          </button>
          
          <button
            onClick={() => setShowCreateKeyForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            Nueva Key
          </button>
        </div>
      </div>

      {/* API Keys Section */}
      {showAPIKeys && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">API Keys</h4>
            <span className="text-sm text-gray-600">
              {activeKeys.length} de {apiKeys.length} activas
            </span>
          </div>
          
          <div className="space-y-2">
            {apiKeys.map(key => (
              <div key={key.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${key.enabled ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <Key className={`w-4 h-4 ${key.enabled ? 'text-green-600' : 'text-gray-400'}`} />
                  </div>
                  
                  <div>
                    <div className="font-medium text-gray-900">{key.name}</div>
                    <div className="text-sm text-gray-600">
                      {key.key.substring(0, 8)}...{key.key.substring(key.key.length - 8)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                      <span>{key.permissions.join(', ')}</span>
                      <span>•</span>
                      <span>{key.usageCount} usos</span>
                      <span>•</span>
                      <span>Creada: {new Date(key.createdAt).toLocaleDateString()}</span>
                      {key.expiresAt && (
                        <>
                          <span>•</span>
                          <span>Expira: {new Date(key.expiresAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(key.key)}
                    className="p-1 text-gray-600 hover:text-gray-700"
                    title="Copiar key"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedKey(key)}
                    className="p-1 text-gray-600 hover:text-gray-700"
                    title="Ver detalles"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onAPIKeyToggle?.(key.id, !key.enabled)}
                    className={`p-1 rounded-lg transition-colors ${
                      key.enabled 
                        ? 'text-green-600 hover:text-green-700 hover:bg-green-50' 
                        : 'text-gray-600 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                    title={key.enabled ? 'Desactivar' : 'Activar'}
                  >
                    {key.enabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => onAPIKeyDelete?.(key.id)}
                    className="p-1 text-red-600 hover:text-red-700"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{totalRequests}</div>
            <div className="text-sm text-gray-600">Total Requests</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {totalRequests - totalErrors}
            </div>
            <div className="text-sm text-gray-600">Exitosos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{totalErrors}</div>
            <div className="text-sm text-gray-600">Errores</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {avgResponseTime.toFixed(0)}ms
            </div>
            <div className="text-sm text-gray-600">Tiempo Promedio</div>
          </div>
        </div>
      </div>

      {/* Endpoints List */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">Endpoints Disponibles</h4>
          <div className="text-sm text-gray-600">
            {endpoints.length} endpoints
          </div>
        </div>
        
        {endpoints.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Globe className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm">No hay endpoints configurados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {endpoints.map(endpoint => (
              <div
                key={endpoint.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedEndpoint(endpoint)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="px-2 py-1 rounded text-xs font-medium text-white"
                    style={{ backgroundColor: METHOD_COLORS[endpoint.method] }}
                  >
                    {endpoint.method}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">{endpoint.path}</div>
                    <div className="text-sm text-gray-600">{endpoint.description}</div>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                      <span>{endpoint.parameters.length} parámetros</span>
                      <span>•</span>
                      <span>{endpoint.responses.length} respuestas</span>
                      {endpoint.authentication && (
                        <>
                          <span>•</span>
                          <span className="text-orange-600">Requiere autenticación</span>
                        </>
                      )}
                      {endpoint.rateLimit && (
                        <>
                          <span>•</span>
                          <span>Rate limit: {endpoint.rateLimit.requests}/{endpoint.rateLimit.window}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      testEndpoint(endpoint);
                    }}
                    className="p-1 text-blue-600 hover:text-blue-700"
                    title="Probar endpoint"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    className="p-1 text-gray-600 hover:text-gray-700"
                    title="Ver documentación"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Test Results */}
      {testResults && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">Resultados de Prueba</h4>
            <button
              onClick={() => setTestResults(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className={`p-3 rounded-lg ${
            testResults.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {testResults.success ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600" />
              )}
              <span className={`font-medium ${
                testResults.success ? 'text-green-900' : 'text-red-900'
              }`}>
                {testResults.success ? 'Éxito' : 'Error'} {testResults.status && `(${testResults.status})`}
              </span>
              <span className="text-sm text-gray-600">
                Tiempo: {testResults.responseTime.toFixed(0)}ms
              </span>
            </div>
            
            {testResults.data && (
              <div className="mt-2">
                <div className="text-sm font-medium text-gray-900 mb-1">Response:</div>
                <pre className="text-xs text-gray-700 bg-white p-2 rounded border overflow-x-auto">
                  {JSON.stringify(testResults.data, null, 2)}
                </pre>
              </div>
            )}
            
            {testResults.error && (
              <div className="mt-2">
                <div className="text-sm font-medium text-red-900 mb-1">Error:</div>
                <div className="text-sm text-red-800">{testResults.error}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Endpoint Detail Modal */}
      {selectedEndpoint && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedEndpoint.method} {selectedEndpoint.path}
                </h3>
                <button
                  onClick={() => setSelectedEndpoint(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Description */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Descripción</h4>
                  <p className="text-sm text-gray-600">{selectedEndpoint.description}</p>
                </div>

                {/* Parameters */}
                {selectedEndpoint.parameters.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Parámetros</h4>
                    <div className="space-y-2">
                      {selectedEndpoint.parameters.map((param, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">{param.name}</span>
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              param.type === 'path' ? 'bg-blue-100 text-blue-700' :
                              param.type === 'query' ? 'bg-green-100 text-green-700' :
                              'bg-purple-100 text-purple-700'
                            }`}>
                              {param.type}
                            </span>
                            {param.required && (
                              <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">
                                Required
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            <span className="font-mono">{param.dataType}</span> - {param.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Responses */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Respuestas</h4>
                  <div className="space-y-2">
                    {selectedEndpoint.responses.map((response, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-1 rounded text-xs font-medium text-white ${
                            response.code < 300 ? 'bg-green-600' :
                            response.code < 400 ? 'bg-blue-600' :
                            response.code < 500 ? 'bg-yellow-600' :
                            'bg-red-600'
                          }`}>
                            {response.code}
                          </span>
                          <span className="font-medium text-gray-900">{response.description}</span>
                        </div>
                        {response.schema && (
                          <div className="mt-2">
                            <pre className="text-xs text-gray-700 bg-white p-2 rounded border overflow-x-auto">
                              {JSON.stringify(response.schema, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Examples */}
                {selectedEndpoint.examples && selectedEndpoint.examples.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Ejemplos</h4>
                    <div className="space-y-4">
                      {selectedEndpoint.examples.map((example, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <h5 className="font-medium text-gray-900 mb-2">{example.name}</h5>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900 mb-1">Request:</div>
                              <pre className="text-xs text-gray-700 bg-gray-50 p-2 rounded overflow-x-auto">
                                {JSON.stringify(example.request, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 mb-1">Response:</div>
                              <pre className="text-xs text-gray-700 bg-gray-50 p-2 rounded overflow-x-auto">
                                {JSON.stringify(example.response, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      testEndpoint(selectedEndpoint);
                      setSelectedEndpoint(null);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    <Play className="w-4 h-4" />
                    Probar Endpoint
                  </button>
                  <button
                    onClick={() => setSelectedEndpoint(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create API Key Modal */}
      {showCreateKeyForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Nueva API Key</h3>
                <button
                  onClick={() => setShowCreateKeyForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Nombre de la API Key"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Permisos</label>
                  <div className="space-y-2">
                    {['read', 'write', 'admin'].map(permission => (
                      <label key={permission} className="flex items-center gap-2">
                        <input type="checkbox" className="rounded border-gray-300" />
                        <span className="text-sm text-gray-700 capitalize">{permission}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiración (opcional)
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() => handleCreateAPIKey({})}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Crear Key
                </button>
                <button
                  onClick={() => setShowCreateKeyForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
