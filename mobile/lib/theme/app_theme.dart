import 'package:flutter/material.dart';

class AppTheme {
  static const Color primary = Color(0xFF1769E0);
  static const Color primaryDark = Color(0xFF8CB8FF);
  static const Color teal = Color(0xFF0F9F8F);
  static const Color success = Color(0xFF168A5B);
  static const Color warning = Color(0xFFD97706);
  static const Color danger = Color(0xFFD14343);
  static const Color ink = Color(0xFF132235);
  static const Color muted = Color(0xFF66788A);
  static const Color canvas = Color(0xFFF4F7FB);

  static ThemeData light() {
    const scheme = ColorScheme(
      brightness: Brightness.light,
      primary: primary,
      onPrimary: Colors.white,
      primaryContainer: Color(0xFFDDEAFF),
      onPrimaryContainer: Color(0xFF0B3B78),
      secondary: teal,
      onSecondary: Colors.white,
      secondaryContainer: Color(0xFFD8F4EE),
      onSecondaryContainer: Color(0xFF064A40),
      error: danger,
      onError: Colors.white,
      surface: Colors.white,
      onSurface: ink,
    );

    return _baseTheme(scheme).copyWith(
      scaffoldBackgroundColor: canvas,
      cardColor: Colors.white,
      dividerColor: const Color(0xFFE2E8F0),
    );
  }

  static ThemeData dark() {
    const scheme = ColorScheme(
      brightness: Brightness.dark,
      primary: primaryDark,
      onPrimary: Color(0xFF082243),
      primaryContainer: Color(0xFF12345F),
      onPrimaryContainer: Color(0xFFDDEAFF),
      secondary: Color(0xFF61D8C7),
      onSecondary: Color(0xFF053C34),
      secondaryContainer: Color(0xFF15483F),
      onSecondaryContainer: Color(0xFFD8F4EE),
      error: Color(0xFFFF9B9B),
      onError: Color(0xFF4A0B0B),
      surface: Color(0xFF111B27),
      onSurface: Color(0xFFF0F5FA),
    );

    return _baseTheme(scheme).copyWith(
      scaffoldBackgroundColor: const Color(0xFF07111C),
      cardColor: const Color(0xFF111B27),
      dividerColor: const Color(0xFF273849),
    );
  }

  static ThemeData _baseTheme(ColorScheme scheme) {
    final isDark = scheme.brightness == Brightness.dark;
    final outline = isDark ? const Color(0xFF2A3A4A) : const Color(0xFFDCE5EE);
    final mutedColor = isDark ? const Color(0xFFB2C0CF) : muted;

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      fontFamily: 'Roboto',
      visualDensity: VisualDensity.standard,
      splashFactory: InkSparkle.splashFactory,
      textTheme: TextTheme(
        displaySmall: TextStyle(
          color: scheme.onSurface,
          fontSize: 34,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.7,
          height: 1.12,
        ),
        headlineLarge: TextStyle(
          color: scheme.onSurface,
          fontSize: 28,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.45,
          height: 1.18,
        ),
        headlineMedium: TextStyle(
          color: scheme.onSurface,
          fontSize: 23,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.25,
          height: 1.22,
        ),
        titleLarge: TextStyle(
          color: scheme.onSurface,
          fontSize: 19,
          fontWeight: FontWeight.w800,
          height: 1.3,
        ),
        titleMedium: TextStyle(
          color: scheme.onSurface,
          fontSize: 16,
          fontWeight: FontWeight.w700,
          height: 1.35,
        ),
        bodyLarge: TextStyle(
          color: scheme.onSurface,
          fontSize: 16,
          height: 1.5,
        ),
        bodyMedium: TextStyle(color: mutedColor, fontSize: 14, height: 1.45),
        labelLarge: TextStyle(
          color: scheme.onSurface,
          fontSize: 14,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.05,
        ),
      ),
      appBarTheme: AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        backgroundColor: scheme.primary,
        foregroundColor: scheme.onPrimary,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: TextStyle(
          color: scheme.onPrimary,
          fontSize: 19,
          fontWeight: FontWeight.w800,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: scheme.surface,
        surfaceTintColor: Colors.transparent,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: outline),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(0, 48),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          minimumSize: const Size(0, 48),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, 48),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          side: BorderSide(color: outline),
          textStyle: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isDark ? const Color(0xFF0B1622) : const Color(0xFFF8FAFC),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
        labelStyle: TextStyle(color: mutedColor),
        hintStyle: TextStyle(color: mutedColor.withValues(alpha: 0.82)),
        prefixIconColor: mutedColor,
        suffixIconColor: mutedColor,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.primary, width: 1.6),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.error),
        ),
      ),
      listTileTheme: ListTileThemeData(
        iconColor: mutedColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 70,
        elevation: 0,
        backgroundColor: isDark ? const Color(0xFF0B1622) : Colors.white,
        indicatorColor: scheme.primaryContainer,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
            color: selected ? scheme.primary : mutedColor,
          );
        }),
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: isDark ? const Color(0xFF0B1622) : Colors.white,
        indicatorColor: scheme.primaryContainer,
        selectedIconTheme: IconThemeData(color: scheme.primary),
        selectedLabelTextStyle: TextStyle(
          color: scheme.primary,
          fontWeight: FontWeight.w800,
        ),
        unselectedIconTheme: IconThemeData(color: mutedColor),
        unselectedLabelTextStyle: TextStyle(
          color: mutedColor,
          fontWeight: FontWeight.w600,
        ),
      ),
      chipTheme: ChipThemeData(
        side: BorderSide(color: outline),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        labelStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
      dividerTheme: DividerThemeData(color: outline, thickness: 1),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      dialogTheme: DialogThemeData(
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: scheme.surface,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
      ),
    );
  }
}

extension ThemeX on BuildContext {
  bool get isDark => Theme.of(this).brightness == Brightness.dark;
  Color get appSurface => Theme.of(this).colorScheme.surface;
  Color get appText => Theme.of(this).colorScheme.onSurface;
  Color get appMuted => isDark ? const Color(0xFFB2C0CF) : AppTheme.muted;
  Color get appBorder =>
      isDark ? const Color(0xFF2A3A4A) : const Color(0xFFDCE5EE);
  Color get appCanvas => isDark ? const Color(0xFF07111C) : AppTheme.canvas;
}
