import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../navigation/hospital_navigation.dart';
import '../../theme/app_theme.dart';

class HospitalShell extends StatelessWidget {
  const HospitalShell({
    super.key,
    required this.child,
    required this.currentPath,
  });

  final Widget child;
  final String currentPath;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final items = HospitalNavigation.forAuth(auth);
    final title = HospitalNavigation.titleForPath(currentPath, auth);

    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth >= 980) {
          return Scaffold(
            body: Row(
              children: [
                _DesktopSidebar(
                  auth: auth,
                  items: items,
                  currentPath: currentPath,
                ),
                VerticalDivider(width: 1, color: context.appBorder),
                Expanded(
                  child: Column(
                    children: [
                      _TopBar(title: title, auth: auth),
                      Expanded(child: child),
                    ],
                  ),
                ),
              ],
            ),
          );
        }

        final primary = HospitalNavigation.primaryForAuth(auth);
        final selectedPrimary = _selectedPrimaryIndex(primary, currentPath);

        return Scaffold(
          appBar: AppBar(
            titleSpacing: 4,
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title),
                Text(
                  _roleLabel(auth),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: context.appMuted,
                      ),
                ),
              ],
            ),
            actions: [
              IconButton(
                tooltip: 'Trợ lý AI',
                onPressed: () => context.go('/ai'),
                icon: const Icon(Icons.auto_awesome_rounded),
              ),
              _UserMenu(auth: auth),
              const SizedBox(width: 6),
            ],
          ),
          drawer: _MobileDrawer(
            auth: auth,
            items: items,
            currentPath: currentPath,
          ),
          body: child,
          bottomNavigationBar: primary.isEmpty
              ? null
              : NavigationBar(
                  selectedIndex: selectedPrimary,
                  onDestinationSelected: (index) {
                    if (index >= 0 && index < primary.length) {
                      context.go(primary[index].route);
                    }
                  },
                  destinations: primary
                      .map(
                        (item) => NavigationDestination(
                          icon: Icon(item.icon),
                          selectedIcon: Icon(item.icon),
                          label: item.label,
                        ),
                      )
                      .toList(),
                ),
          floatingActionButton: currentPath == '/ai'
              ? null
              : FloatingActionButton.extended(
                  onPressed: () => context.go('/ai'),
                  icon: const Icon(Icons.auto_awesome_rounded),
                  label: const Text('Trợ lý AI'),
                ),
        );
      },
    );
  }

  int _selectedPrimaryIndex(
    List<HospitalNavItem> items,
    String currentPath,
  ) {
    for (var index = 0; index < items.length; index++) {
      if (HospitalNavigation.isSelected(currentPath, items[index].route)) {
        return index;
      }
    }
    return 0;
  }
}

class _DesktopSidebar extends StatelessWidget {
  const _DesktopSidebar({
    required this.auth,
    required this.items,
    required this.currentPath,
  });

  final AuthProvider auth;
  final List<HospitalNavItem> items;
  final String currentPath;

  @override
  Widget build(BuildContext context) {
    final grouped = _groupItems(items);

    return Container(
      width: 288,
      color: context.isDark ? const Color(0xFF0B1622) : Colors.white,
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 14),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppTheme.primary, AppTheme.teal],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(
                      Icons.local_hospital_rounded,
                      color: Colors.white,
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Hospital P2TB',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _roleLabel(auth),
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: context.appMuted,
                              ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Divider(height: 1, color: context.appBorder),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(10, 12, 10, 16),
                children: [
                  for (final group in grouped.entries) ...[
                    Padding(
                      padding: const EdgeInsets.fromLTRB(10, 14, 10, 6),
                      child: Text(
                        group.key.toUpperCase(),
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: context.appMuted,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.8,
                            ),
                      ),
                    ),
                    ...group.value.map(
                      (item) => _NavigationTile(
                        item: item,
                        selected: HospitalNavigation.isSelected(
                          currentPath,
                          item.route,
                        ),
                        onTap: () => context.go(item.route),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Divider(height: 1, color: context.appBorder),
            Padding(
              padding: const EdgeInsets.all(12),
              child: _ProfileSummary(auth: auth),
            ),
          ],
        ),
      ),
    );
  }
}

class _MobileDrawer extends StatelessWidget {
  const _MobileDrawer({
    required this.auth,
    required this.items,
    required this.currentPath,
  });

  final AuthProvider auth;
  final List<HospitalNavItem> items;
  final String currentPath;

  @override
  Widget build(BuildContext context) {
    final grouped = _groupItems(items);

    return NavigationDrawer(
      selectedIndex: _selectedIndex(items, currentPath),
      onDestinationSelected: (index) {
        Navigator.of(context).pop();
        if (index >= 0 && index < items.length) {
          context.go(items[index].route);
        }
      },
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 18),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppTheme.primary, AppTheme.teal],
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(
                  Icons.local_hospital_rounded,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Hospital P2TB',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    Text(
                      _roleLabel(auth),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: context.appMuted,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        for (final group in grouped.entries) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(28, 16, 20, 6),
            child: Text(
              group.key.toUpperCase(),
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: context.appMuted,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                  ),
            ),
          ),
          for (final item in group.value)
            NavigationDrawerDestination(
              icon: Icon(item.icon),
              selectedIcon: Icon(item.icon),
              label: Text(item.label),
            ),
        ],
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          child: Divider(),
        ),
        ListTile(
          leading: const Icon(Icons.logout_rounded),
          title: const Text('Đăng xuất'),
          onTap: () async {
            Navigator.of(context).pop();
            await auth.logout();
            if (context.mounted) context.go('/login');
          },
        ),
        const SizedBox(height: 12),
      ],
    );
  }

  int _selectedIndex(List<HospitalNavItem> items, String currentPath) {
    for (var index = 0; index < items.length; index++) {
      if (HospitalNavigation.isSelected(currentPath, items[index].route)) {
        return index;
      }
    }
    return 0;
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.title, required this.auth});

  final String title;
  final AuthProvider auth;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 72,
      padding: const EdgeInsets.symmetric(horizontal: 24),
      decoration: BoxDecoration(
        color: context.isDark ? const Color(0xFF0B1622) : Colors.white,
        border: Border(bottom: BorderSide(color: context.appBorder)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleLarge),
                Text(
                  'Dữ liệu được đồng bộ từ AWS backend',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: context.appMuted,
                      ),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Trợ lý AI',
            onPressed: () => context.go('/ai'),
            icon: const Icon(Icons.auto_awesome_rounded),
          ),
          const SizedBox(width: 8),
          _UserMenu(auth: auth),
        ],
      ),
    );
  }
}

class _UserMenu extends StatelessWidget {
  const _UserMenu({required this.auth});
  final AuthProvider auth;

  @override
  Widget build(BuildContext context) {
    final displayName = auth.tenDangNhap ?? auth.email ?? 'Người dùng';
    final initials = _initials(displayName);

    return PopupMenuButton<String>(
      tooltip: 'Tài khoản',
      onSelected: (value) async {
        if (value == 'profile') {
          context.go('/profile');
        } else if (value == 'logout') {
          await auth.logout();
          if (context.mounted) context.go('/login');
        }
      },
      itemBuilder: (context) => const [
        PopupMenuItem(
          value: 'profile',
          child: ListTile(
            leading: Icon(Icons.account_circle_rounded),
            title: Text('Hồ sơ cá nhân'),
          ),
        ),
        PopupMenuItem(
          value: 'logout',
          child: ListTile(
            leading: Icon(Icons.logout_rounded),
            title: Text('Đăng xuất'),
          ),
        ),
      ],
      child: CircleAvatar(
        radius: 20,
        backgroundColor: Theme.of(context).colorScheme.primaryContainer,
        foregroundColor: Theme.of(context).colorScheme.primary,
        child: Text(
          initials,
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
    );
  }
}

class _NavigationTile extends StatelessWidget {
  const _NavigationTile({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final HospitalNavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: ListTile(
        dense: true,
        selected: selected,
        selectedTileColor: primary.withValues(alpha: 0.10),
        leading: Icon(item.icon, color: selected ? primary : context.appMuted),
        title: Text(
          item.label,
          style: TextStyle(
            color: selected ? primary : context.appText,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
          ),
        ),
        onTap: onTap,
      ),
    );
  }
}

class _ProfileSummary extends StatelessWidget {
  const _ProfileSummary({required this.auth});
  final AuthProvider auth;

  @override
  Widget build(BuildContext context) {
    final name = auth.tenDangNhap ?? auth.email ?? 'Người dùng';
    return InkWell(
      onTap: () => context.go('/profile'),
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Row(
          children: [
            CircleAvatar(
              radius: 20,
              backgroundColor: Theme.of(context).colorScheme.primaryContainer,
              foregroundColor: Theme.of(context).colorScheme.primary,
              child: Text(
                _initials(name),
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelLarge,
                  ),
                  Text(
                    auth.email ?? _roleLabel(auth),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: context.appMuted,
                        ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded),
          ],
        ),
      ),
    );
  }
}

Map<String, List<HospitalNavItem>> _groupItems(List<HospitalNavItem> items) {
  final grouped = <String, List<HospitalNavItem>>{};
  for (final item in items) {
    grouped.putIfAbsent(item.group, () => []).add(item);
  }
  return grouped;
}

String _roleLabel(AuthProvider auth) {
  switch (auth.role) {
    case 'ADMIN':
      return 'Quản trị viên';
    case 'BACSI':
      return 'Bác sĩ';
    case 'BENHNHAN':
      return 'Bệnh nhân';
    case 'NHANSU':
      switch (auth.loaiNS) {
        case 'YT':
          return 'Y tá / Điều dưỡng';
        case 'XN':
          return 'Nhân viên xét nghiệm';
        case 'TN':
          return 'Nhân viên tiếp nhận';
        default:
          return 'Nhân sự y tế';
      }
    default:
      return 'Người dùng';
  }
}

String _initials(String value) {
  final parts = value
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .toList();
  if (parts.isEmpty) return 'HP';
  if (parts.length == 1) {
    return parts.first.substring(0, parts.first.length >= 2 ? 2 : 1).toUpperCase();
  }
  return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
}
