import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAppContext } from '../Context';
import {
  VscFolder,
  VscDeviceMobile,
  VscSearch,
  VscTag,
  VscOrganization,
  VscNote,
  VscColorMode,
  VscCloudUpload,
  VscHistory,
  VscShield,
  VscGlobe,
  VscTerminal,
  VscArrowRight,
  VscLock,
  VscFlame
} from 'react-icons/vsc';

function FeaturesPage() {
  const { openAuthModal, user } = useAppContext();

  const featureCards = [
    {
      title: 'Smart Organization',
      description: 'Automatically categorize code and workspaces into directories based on file types, language extensions, and project architecture.',
      icon: VscFolder,
      iconColor: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/20',
    },
    {
      title: 'Cross-Device Syncing',
      description: 'Seamlessly sync your live codespaces across all browsers and devices in sub-millisecond real-time with zero friction.',
      icon: VscDeviceMobile,
      iconColor: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
    },
    {
      title: 'Full-Text Search',
      description: 'Quickly find files and symbols not just by filename, but also across multi-file contents with fast Monaco full-text indexing.',
      icon: VscSearch,
      iconColor: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/20',
    },
    {
      title: 'Tagging System',
      description: 'Organize files and projects with language detection and tags for rapid retrieval, sorting, and focused pair-programming.',
      icon: VscTag,
      iconColor: 'text-amber-300',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
    },
    {
      title: 'Shared Collections',
      description: 'Share rooms and codespaces instantly with teammates via QR codes, unique links, or custom URLs with fine-grained access control.',
      icon: VscOrganization,
      iconColor: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
    },
    {
      title: 'Bookmark Notes',
      description: 'Maintain persistent project scratchpads, documentation files, and annotations to highlight key context for collaborators.',
      icon: VscNote,
      iconColor: 'text-teal-400',
      bgColor: 'bg-teal-500/10',
      borderColor: 'border-teal-500/20',
    },
    {
      title: 'Customizable Themes',
      description: 'Personalize your workspace with 10+ professional themes including VS Dark, Monokai, Nord, Dracula, Synthwave, and Cyberpunk.',
      icon: VscColorMode,
      iconColor: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/20',
    },
    {
      title: 'Import/Export Functionality',
      description: 'Import file trees and export entire projects or individual snippets directly to disk or backup services in standard formats.',
      icon: VscCloudUpload,
      iconColor: 'text-sky-400',
      bgColor: 'bg-sky-500/10',
      borderColor: 'border-sky-500/20',
    },
    {
      title: 'Extended Retention',
      description: 'Keep your codespaces persistent for 60 days on active authenticated accounts, with 200MB storage and automatic activity extensions.',
      icon: VscHistory,
      iconColor: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
    },
    {
      title: 'Passcode Protection',
      description: 'Lock your room with password security so only authorized collaborators with the passcode can view or edit your code.',
      icon: VscLock,
      iconColor: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/20',
    },
    {
      title: 'Integrated Terminal & Preview',
      description: 'Run commands in real-time, view live HTML/JS web previews, and evaluate scripts directly within the browser canvas.',
      icon: VscTerminal,
      iconColor: 'text-violet-400',
      bgColor: 'bg-violet-500/10',
      borderColor: 'border-violet-500/20',
    },
    {
      title: 'Custom Clean URLs',
      description: 'Create memorable custom URLs and brand slugs for your workspaces, complete with live QR codes for mobile access.',
      icon: VscGlobe,
      iconColor: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar />

      {/* Background gradients */}
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-blue-950/20 via-black to-purple-950/20 pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.015)_1px,transparent_1px)] bg-size-[48px_48px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          {/* Header section */}
          <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-xs font-semibold uppercase tracking-wider text-blue-400 mb-4">
              <span>Platform Capabilities</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6">
              Everything you need to collaborate seamlessly
            </h1>
            <p className="text-lg text-gray-400">
              Designed from the ground up for speed, security, and developer clarity. Discover the tools built to supercharge your real-time workflow.
            </p>
          </div>

          {/* Features Grid - Clean layout matching reference image */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
            {featureCards.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="flex items-start space-x-4 p-5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all duration-200"
                >
                  {/* Clean Square Icon Container */}
                  <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border ${item.bgColor} ${item.borderColor}`}>
                    <Icon className={`w-6 h-6 ${item.iconColor}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-white mb-1.5 tracking-tight">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA Banner */}
          <div className="mt-20 p-8 sm:p-12 rounded-2xl border border-white/10 bg-linear-to-r from-blue-900/30 via-purple-900/20 to-blue-900/30 text-center max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Ready to code together?
            </h2>
            <p className="text-gray-300 max-w-xl mx-auto mb-8 text-sm sm:text-base">
              Start an instant session without registration, or create a free account to unlock folders and 60-day persistent workspaces.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/"
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-lg bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium shadow-lg shadow-blue-500/20 transition-all transform hover:scale-105"
              >
                <span>Launch Codespace</span>
                <VscArrowRight className="ml-2 w-4 h-4" />
              </Link>
              {!user && (
                <button
                  onClick={() => openAuthModal('register')}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-lg border border-white/20 hover:bg-white/10 text-white font-medium transition-colors cursor-pointer"
                >
                  Create Free Account
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FeaturesPage;
