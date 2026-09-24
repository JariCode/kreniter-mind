const clerkAppearance = {
  variables: {
    colorPrimary: '#1688ff',
    colorBackground: '#0d131d',
    colorInputBackground: '#080b10',
    colorInputForeground: '#e7edf5',
    colorForeground: '#e7edf5',
    colorMutedForeground: '#718092',
    colorBorder: '#202730',
    colorDanger: '#ef4444',
    colorModalBackdrop: 'rgba(5, 7, 11, 0.82)',
    borderRadius: '10px',
  },

  options: {
    privacyPageUrl: '',
  },

  elements: {
    modalBackdrop: {
      backgroundColor: 'rgba(5, 7, 11, 0.82)',
      backdropFilter: 'blur(6px)',
    },

    card: {
      backgroundColor: '#0d131d',
      border: 'none',
      borderRadius: '10px',
      boxShadow: 'none',
    },

    cardBox: {
      backgroundColor: '#0d131d',
      border: '1px solid rgba(22, 136, 255, 0.38)',
      borderRadius: '10px',
      boxShadow:
        '0 0 0 1px rgba(22, 136, 255, 0.14), 0 0 24px rgba(22, 136, 255, 0.16), 0 10px 30px rgba(0, 0, 0, 0.18)',
    },

    footer: {
      backgroundColor: '#0d131d',
      borderTop: '1px solid #202730',
    },

    headerTitle: {
      color: '#e7edf5',
    },

    headerSubtitle: {
      color: '#718092',
    },

    formFieldLabel: {
      color: '#b7c2ce',
    },

    formFieldInput: {
      backgroundColor: '#080b10',
      borderColor: '#202730',
      color: '#e7edf5',
    },

    formFieldInputShowPasswordButton: {
      color: '#718092',
    },

    formButtonPrimary: {
      backgroundColor: '#1688ff',
      color: '#ffffff',
      boxShadow:
        '0 0 0 1px rgba(22, 136, 255, 0.14), 0 0 18px rgba(22, 136, 255, 0.18)',
    },

    formButtonPrimaryHover: {
      backgroundColor: '#1688ff',
      boxShadow:
        '0 0 0 1px rgba(22, 136, 255, 0.22), 0 0 24px rgba(22, 136, 255, 0.30)',
    },

    socialButtonsBlockButton: {
      backgroundColor: '#111a26',
      border: '1px solid #202730',
      color: '#e7edf5',
      boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.02)',
    },

    socialButtonsBlockButtonText: {
      color: '#e7edf5',
    },

    socialButtonsBlockButtonHover: {
      backgroundColor: '#151f2c',
      borderColor: 'rgba(22, 136, 255, 0.55)',
      boxShadow:
        '0 0 0 1px rgba(22, 136, 255, 0.12), 0 0 18px rgba(22, 136, 255, 0.14)',
    },

    footerActionLink: {
      color: '#1688ff',
    },

    footerActionText: {
      color: '#718092',
    },

    identityPreviewText: {
      color: '#e7edf5',
    },

    identityPreviewEditButton: {
      color: '#1688ff',
    },

    navbar: {
      backgroundColor: '#0d131d',
      borderRight: '1px solid #202730',
    },

    navbarButton: {
      color: '#b7c2ce',
    },

    navbarButtonActive: {
      color: '#e7edf5',
      backgroundColor: 'rgba(22, 136, 255, 0.10)',
    },

    profileSectionPrimaryButton: {
      color: '#1688ff',
    },

    profileSectionContent: {
      color: '#e7edf5',
    },

    profileSectionTitle: {
      color: '#e7edf5',
    },

    menuButton: {
      color: '#b7c2ce',
    },

    menuButtonHover: {
      backgroundColor: '#151f2c',
      color: '#e7edf5',
    },
  },
}

export default clerkAppearance