module.exports = ({ config }) => {
  const isWholesaler = process.env.EXPO_PUBLIC_APP_VARIANT === "wholesaler";

  return {
    ...config,
    icon: isWholesaler ? './assets/tofado-wholesaler-icon.png' : config.icon,
    name: isWholesaler ? "Tofado Wholesaler" : "Tofado Retailer",
    slug: isWholesaler ? "tofado-business" : "tofado",
    scheme: isWholesaler ? "tofado-business" : "tofado",
    ios: {
      ...config.ios,
      bundleIdentifier: isWholesaler ? "com.tofado.business" : "com.tofado.app",
    },
    android: {
      ...config.android,
      adaptiveIcon: isWholesaler ? { foregroundImage: './assets/tofado-wholesaler-icon.png', backgroundColor: '#2874F0' } : config.android.adaptiveIcon,
      package: isWholesaler ? "com.tofado.business" : "com.tofado.app",
    },
    plugins: config.plugins.map((plugin) => {
      if (!Array.isArray(plugin) || plugin[0] !== "expo-image-picker") return plugin;
      return [plugin[0], {
        ...plugin[1],
        photosPermission: isWholesaler
          ? "Allow Tofado Wholesaler to select product and company photos."
          : "Allow Tofado Retailer to select business and order photos.",
      }];
    }),
  };
};
