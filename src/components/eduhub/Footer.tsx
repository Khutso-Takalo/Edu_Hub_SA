import React, { useState } from 'react';
import { GraduationCap, Mail, Phone, MapPin, Send, Heart, ExternalLink, Facebook, Instagram, Linkedin, Youtube } from 'lucide-react';

interface FooterProps {
  onNavigate: (view: string) => void;
}

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const socialLinks = [
    {
      label: 'Facebook',
      href: 'https://www.facebook.com/',
      icon: Facebook,
      color: 'hover:border-blue-400 hover:text-blue-300 hover:bg-blue-500/10',
    },
    {
      label: 'Instagram',
      href: 'https://www.instagram.com/',
      icon: Instagram,
      color: 'hover:border-pink-400 hover:text-pink-300 hover:bg-pink-500/10',
    },
    {
      label: 'LinkedIn',
      href: 'https://www.linkedin.com/',
      icon: Linkedin,
      color: 'hover:border-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10',
    },
    {
      label: 'YouTube',
      href: 'https://www.youtube.com/',
      icon: Youtube,
      color: 'hover:border-red-400 hover:text-red-300 hover:bg-red-500/10',
    },
  ];

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 5000);
    }
  };

  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Newsletter Section */}
      <div className="border-b border-gray-800">
        <div className="section-shell py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="display-heading text-xl text-white">Stay Updated</h3>
              <p className="text-sm text-gray-400 mt-1 leading-relaxed">Get the latest bursary deadlines and career tips delivered to your inbox</p>
            </div>
            <form onSubmit={handleSubscribe} className="flex w-full flex-col gap-3 sm:flex-row md:w-auto md:flex-row">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full flex-1 md:w-72 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                required
              />
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-green-500 text-white font-medium rounded-lg hover:from-blue-700 hover:to-green-600 transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Subscribe
              </button>
            </form>
            {subscribed && (
              <p className="text-green-400 text-sm font-medium">Thanks for subscribing!</p>
            )}
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="section-shell py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-700 to-green-600 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-white">EduHub</span>
                <span className="text-lg font-bold text-green-400"> SA</span>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Your gateway to educational success in South Africa. Connecting learners with bursaries, careers, and institutions.
            </p>
            {/* SA flag colors */}
            <div className="flex gap-1 mt-4">
              <div className="h-1 w-6 bg-green-500 rounded-full" />
              <div className="h-1 w-6 bg-yellow-400 rounded-full" />
              <div className="h-1 w-6 bg-red-500 rounded-full" />
              <div className="h-1 w-6 bg-blue-400 rounded-full" />
              <div className="h-1 w-6 bg-white rounded-full" />
              <div className="h-1 w-6 bg-black rounded-full" />
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Explore</h4>
            <ul className="space-y-2.5">
              {[
                { id: 'careers', label: 'Career Explorer' },
                { id: 'bursaries', label: 'Bursary Finder' },
                { id: 'institutions', label: 'Institutions' },
                { id: 'papers', label: 'Past Papers' },
                { id: 'resources', label: 'Guides & Resources' },
              ].map(link => (
                <li key={link.id}>
                  <button
                    onClick={() => onNavigate(link.id)}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-white font-semibold mb-4">Resources</h4>
            <ul className="space-y-2.5">
              {[
                'How to Apply for NSFAS',
                'Understanding NQF Levels',
                'APS Score Calculator',
                'TVET vs University',
                'Building Your CV',
                'Writing Application Essays',
              ].map(item => (
                <li key={item}>
                  <button
                    onClick={() => onNavigate(item === 'Building Your CV' ? 'cv-builder' : item === 'Writing Application Essays' ? 'essay-studio' : 'resources')}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold mb-4">Contact</h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="mailto:info@eduhubsa.co.za"
                  className="group inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <Mail className="w-4 h-4 text-gray-500 group-hover:text-blue-300" />
                  info@eduhubsa.co.za
                </a>
              </li>
              <li>
                <a
                  href="tel:+27110000000"
                  className="group inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <Phone className="w-4 h-4 text-gray-500 group-hover:text-green-300" />
                  +27 11 000 0000
                </a>
              </li>
              <li>
                <a
                  href="https://maps.google.com/?q=Johannesburg,Gauteng,South+Africa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <MapPin className="w-4 h-4 text-gray-500 group-hover:text-yellow-300" />
                  Johannesburg, Gauteng, SA
                </a>
              </li>
            </ul>
            {/* Social Links */}
            <div className="flex gap-2.5 mt-4">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Follow EduHub SA on ${social.label}`}
                    className={`group w-10 h-10 rounded-xl border border-gray-700 bg-gray-800/90 flex items-center justify-center text-gray-400 transition-all ${social.color}`}
                    title={social.label}
                  >
                    <Icon className="w-4.5 h-4.5" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800">
        <div className="section-shell py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              {new Date().getFullYear()} EduHub SA. All rights reserved. Made with <Heart className="w-3 h-3 inline text-red-500" /> in South Africa.
            </p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 sm:justify-end">
              <button className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Privacy Policy</button>
              <button className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Terms of Service</button>
              <button className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Disclaimer</button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
