import React from 'react';
import { FaHtml5, FaCss3Alt, FaJs, FaReact, FaPython, FaJava, FaDocker } from 'react-icons/fa';
import { SiYaml } from 'react-icons/si';
import { VscFile, VscFileCode, VscOutput } from 'react-icons/vsc';

const FileIcon = ({ fileName }) => {
  if (!fileName) return <VscFile className="mr-2 text-gray-400 shrink-0" />;

  const lowerName = fileName.toLowerCase();

  // Special file name checks
  if (lowerName === 'dockerfile' || lowerName.startsWith('dockerfile.')) {
    return <FaDocker className="mr-2 text-blue-400 shrink-0" />;
  }

  const extension = lowerName.split('.').pop();

  switch (extension) {
    case 'html':
    case 'htm':
      return <FaHtml5 className="mr-2 text-orange-500 shrink-0" />;
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return <FaCss3Alt className="mr-2 text-blue-500 shrink-0" />;
    case 'js':
    case 'mjs':
    case 'cjs':
      return <FaJs className="mr-2 text-yellow-400 shrink-0" />;
    case 'jsx':
      return <FaReact className="mr-2 text-cyan-400 shrink-0" />;
    case 'ts':
    case 'tsx':
      return <VscFileCode className="mr-2 text-blue-400 shrink-0" />;
    case 'py':
      return <FaPython className="mr-2 text-blue-400 shrink-0" />;
    case 'java':
      return <FaJava className="mr-2 text-red-500 shrink-0" />;
    case 'yml':
    case 'yaml':
      return <SiYaml className="mr-2 text-red-400 shrink-0" />;
    case 'dockerfile':
      return <FaDocker className="mr-2 text-blue-400 shrink-0" />;
    case 'log':
      return <VscOutput className="mr-2 text-amber-300 shrink-0" />;
    case 'json':
      return <VscFileCode className="mr-2 text-yellow-500 shrink-0" />;
    case 'txt':
    default:
      return <VscFile className="mr-2 text-gray-400 shrink-0" />;
  }
};

export default FileIcon;
