import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../theme/app_theme.dart';

class HospitalPage extends StatelessWidget {
  const HospitalPage({
    super.key,
    required this.children,
    this.onRefresh,
    this.floatingActionButton,
    this.padding,
  });

  final List<Widget> children;
  final Future<void> Function()? onRefresh;
  final Widget? floatingActionButton;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final content = LayoutBuilder(
      builder: (context, constraints) {
        final horizontal = constraints.maxWidth >= 1000
            ? 32.0
            : constraints.maxWidth >= 700
            ? 24.0
            : 16.0;
        return Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1220),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding:
                  padding ??
                  EdgeInsets.fromLTRB(horizontal, 22, horizontal, 120),
              children: children,
            ),
          ),
        );
      },
    );

    return Stack(
      children: [
        if (onRefresh != null)
          RefreshIndicator(onRefresh: onRefresh!, child: content)
        else
          content,
        if (floatingActionButton != null)
          Positioned(right: 20, bottom: 24, child: floatingActionButton!),
      ],
    );
  }
}

class PageHeader extends StatelessWidget {
  const PageHeader({
    super.key,
    required this.title,
    required this.subtitle,
    this.icon,
    this.actions = const [],
    this.badge,
  });

  final String title;
  final String subtitle;
  final IconData? icon;
  final List<Widget> actions;
  final Widget? badge;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 680;
        final leading = icon == null
            ? null
            : Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  icon,
                  color: Theme.of(context).colorScheme.primary,
                  size: 28,
                ),
              );

        final text = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Flexible(
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                ),
                if (badge != null) ...[const SizedBox(width: 10), badge!],
              ],
            ),
            const SizedBox(height: 5),
            Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
          ],
        );

        if (compact) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (leading != null) ...[leading, const SizedBox(width: 14)],
                  Expanded(child: text),
                ],
              ),
              if (actions.isNotEmpty) ...[
                const SizedBox(height: 16),
                Wrap(spacing: 10, runSpacing: 10, children: actions),
              ],
            ],
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            if (leading != null) ...[leading, const SizedBox(width: 16)],
            Expanded(child: text),
            if (actions.isNotEmpty)
              Wrap(spacing: 10, runSpacing: 10, children: actions),
          ],
        );
      },
    );
  }
}

class HospitalCard extends StatelessWidget {
  const HospitalCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.onTap,
    this.borderColor,
    this.backgroundColor,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? borderColor;
  final Color? backgroundColor;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: backgroundColor ?? context.appSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: borderColor ?? context.appBorder),
        boxShadow: [
          if (!context.isDark)
            BoxShadow(
              color: const Color(0xFF173A5E).withValues(alpha: 0.06),
              blurRadius: 22,
              offset: const Offset(0, 10),
            ),
        ],
      ),
      child: child,
    );

    if (onTap == null) return card;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: card,
      ),
    );
  }
}

class MetricCard extends StatelessWidget {
  const MetricCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.color,
    this.caption,
    this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color? color;
  final String? caption;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final accent = color ?? Theme.of(context).colorScheme.primary;
    return HospitalCard(
      onTap: onTap,
      padding: const EdgeInsets.all(17),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: context.isDark ? 0.18 : 0.10),
              borderRadius: BorderRadius.circular(15),
            ),
            child: Icon(icon, color: accent, size: 25),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 2),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                if (caption != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    caption!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: context.appMuted),
                  ),
                ],
              ],
            ),
          ),
          if (onTap != null)
            Icon(Icons.chevron_right_rounded, color: context.appMuted),
        ],
      ),
    );
  }
}

class ResponsiveGrid extends StatelessWidget {
  const ResponsiveGrid({
    super.key,
    required this.children,
    this.minItemWidth = 260,
    this.spacing = 14,
  });

  final List<Widget> children;
  final double minItemWidth;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final count = (constraints.maxWidth / minItemWidth).floor().clamp(1, 4);
        final itemWidth =
            (constraints.maxWidth - (count - 1) * spacing) / count;
        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: children
              .map((child) => SizedBox(width: itemWidth, child: child))
              .toList(),
        );
      },
    );
  }
}

class FeatureCard extends StatelessWidget {
  const FeatureCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
    this.color,
    this.trailing,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;
  final Color? color;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final accent = color ?? Theme.of(context).colorScheme.primary;
    return HospitalCard(
      onTap: onTap,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: context.isDark ? 0.18 : 0.10),
              borderRadius: BorderRadius.circular(15),
            ),
            child: Icon(icon, color: accent),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 5),
                Text(
                  subtitle,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          trailing ?? Icon(Icons.arrow_forward_rounded, color: accent),
        ],
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle({
    super.key,
    required this.title,
    this.subtitle,
    this.action,
  });

  final String title;
  final String? subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleLarge),
              if (subtitle != null) ...[
                const SizedBox(height: 3),
                Text(subtitle!, style: Theme.of(context).textTheme.bodyMedium),
              ],
            ],
          ),
        ),
        if (action != null) action!,
      ],
    );
  }
}

class StatusBadge extends StatelessWidget {
  const StatusBadge(this.status, {super.key});

  final String? status;

  @override
  Widget build(BuildContext context) {
    final normalized = (status ?? 'UNKNOWN').trim().toUpperCase();
    final style = _style(normalized);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: style.color.withValues(alpha: context.isDark ? 0.22 : 0.11),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: style.color.withValues(alpha: 0.32)),
      ),
      child: Text(
        style.label,
        style: TextStyle(
          color: style.color,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  _StatusStyle _style(String value) {
    switch (value) {
      case 'ACTIVE':
      case 'AVAILABLE':
      case 'COMPLETED':
      case 'HOAN_THANH':
      case 'DA_THANH_TOAN':
      case 'CONFIRMED':
      case 'DA_XAC_NHAN':
      case 'SUCCESS':
        return const _StatusStyle('Đang hoạt động', AppTheme.success);
      case 'PENDING':
      case 'PENDING_UPLOAD':
      case 'CHO_XAC_NHAN':
      case 'DANG_CHO':
      case 'UNCONFIRMED':
        return const _StatusStyle('Đang chờ', AppTheme.warning);
      case 'IN_PROGRESS':
      case 'DANG_KHAM':
      case 'PROCESSING':
        return const _StatusStyle('Đang xử lý', AppTheme.primary);
      case 'CANCELLED':
      case 'DA_HUY':
      case 'DISABLED':
      case 'REJECTED':
      case 'FAILED':
        return const _StatusStyle('Đã dừng', AppTheme.danger);
      default:
        return _StatusStyle(
          value.isEmpty ? 'Không rõ' : value.replaceAll('_', ' '),
          AppTheme.muted,
        );
    }
  }
}

class _StatusStyle {
  const _StatusStyle(this.label, this.color);
  final String label;
  final Color color;
}

class SearchField extends StatelessWidget {
  const SearchField({
    super.key,
    required this.controller,
    required this.onChanged,
    this.hint = 'Tìm kiếm...',
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final String hint;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      decoration: InputDecoration(
        hintText: hint,
        prefixIcon: const Icon(Icons.search_rounded),
        suffixIcon: controller.text.isEmpty
            ? null
            : IconButton(
                tooltip: 'Xóa tìm kiếm',
                onPressed: () {
                  controller.clear();
                  onChanged('');
                },
                icon: const Icon(Icons.close_rounded),
              ),
      ),
    );
  }
}

class LoadingState extends StatelessWidget {
  const LoadingState({super.key, this.label = 'Đang tải dữ liệu...'});
  final String label;

  @override
  Widget build(BuildContext context) {
    return HospitalCard(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 36),
        child: Column(
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 14),
            Text(label, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.title,
    required this.message,
    this.icon = Icons.inbox_rounded,
    this.action,
  });

  final String title;
  final String message;
  final IconData icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return HospitalCard(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 28),
        child: Column(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Icon(
                icon,
                color: Theme.of(context).colorScheme.primary,
                size: 32,
              ),
            ),
            const SizedBox(height: 14),
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 5),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Text(
                message,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
            if (action != null) ...[const SizedBox(height: 16), action!],
          ],
        ),
      ),
    );
  }
}

class ErrorState extends StatelessWidget {
  const ErrorState({
    super.key,
    required this.message,
    required this.onRetry,
    this.title = 'Không thể tải dữ liệu',
  });

  final String title;
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return EmptyState(
      title: title,
      message: message,
      icon: Icons.cloud_off_rounded,
      action: FilledButton.icon(
        onPressed: onRetry,
        icon: const Icon(Icons.refresh_rounded),
        label: const Text('Thử lại'),
      ),
    );
  }
}

class EndpointBadge extends StatelessWidget {
  const EndpointBadge({super.key, required this.method, required this.path});

  final String method;
  final String path;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: '$method $path',
      child: Container(
        constraints: const BoxConstraints(maxWidth: 360),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: context.isDark
              ? const Color(0xFF182635)
              : const Color(0xFFEFF4F8),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: context.appBorder),
        ),
        child: Text(
          '$method $path',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: context.appMuted,
            fontSize: 11.5,
            fontWeight: FontWeight.w700,
            fontFamily: 'monospace',
          ),
        ),
      ),
    );
  }
}

class DataListTile extends StatelessWidget {
  const DataListTile({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    this.status,
    this.onTap,
    this.trailing,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final String? status;
  final VoidCallback? onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return HospitalCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primaryContainer,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: Theme.of(context).colorScheme.primary),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          if (status != null) ...[
            const SizedBox(width: 10),
            StatusBadge(status),
          ],
          if (trailing != null) ...[
            const SizedBox(width: 8),
            trailing!,
          ] else if (onTap != null) ...[
            const SizedBox(width: 8),
            Icon(Icons.chevron_right_rounded, color: context.appMuted),
          ],
        ],
      ),
    );
  }
}

class KeyValueGrid extends StatelessWidget {
  const KeyValueGrid({
    super.key,
    required this.data,
    this.labels = const {},
    this.hiddenKeys = const {},
  });

  final Map<String, dynamic> data;
  final Map<String, String> labels;
  final Set<String> hiddenKeys;

  @override
  Widget build(BuildContext context) {
    final entries = data.entries
        .where((entry) => !hiddenKeys.contains(entry.key))
        .where((entry) => entry.value != null)
        .toList();

    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 760 ? 2 : 1;
        const gap = 12.0;
        final width = (constraints.maxWidth - (columns - 1) * gap) / columns;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: entries.map((entry) {
            return SizedBox(
              width: width,
              child: Container(
                padding: const EdgeInsets.all(13),
                decoration: BoxDecoration(
                  color: context.isDark
                      ? const Color(0xFF0C1723)
                      : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: context.appBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      labels[entry.key] ?? humanizeKey(entry.key),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: context.appMuted,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 5),
                    SelectableText(
                      formatValue(entry.value),
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        );
      },
    );
  }
}

Future<void> showDataDetails(
  BuildContext context, {
  required String title,
  required Map<String, dynamic> data,
  Map<String, String> labels = const {},
  List<Widget> actions = const [],
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (sheetContext) {
      return DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.78,
        minChildSize: 0.5,
        maxChildSize: 0.96,
        builder: (context, controller) {
          return CustomScrollView(
            controller: controller,
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
                  child: Center(
                    child: Container(
                      width: 46,
                      height: 5,
                      decoration: BoxDecoration(
                        color: context.appBorder,
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 30),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            title,
                            style: Theme.of(context).textTheme.headlineMedium,
                          ),
                        ),
                        IconButton(
                          tooltip: 'Sao chép JSON',
                          onPressed: () async {
                            await Clipboard.setData(
                              ClipboardData(
                                text: const JsonEncoder.withIndent(
                                  '  ',
                                ).convert(data),
                              ),
                            );
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Đã sao chép dữ liệu.'),
                                ),
                              );
                            }
                          },
                          icon: const Icon(Icons.copy_all_rounded),
                        ),
                        IconButton(
                          tooltip: 'Đóng',
                          onPressed: () => Navigator.of(context).pop(),
                          icon: const Icon(Icons.close_rounded),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    KeyValueGrid(data: data, labels: labels),
                    if (actions.isNotEmpty) ...[
                      const SizedBox(height: 20),
                      Wrap(spacing: 10, runSpacing: 10, children: actions),
                    ],
                  ]),
                ),
              ),
            ],
          );
        },
      );
    },
  );
}

String firstText(
  Map<String, dynamic> data,
  List<String> keys, {
  String fallback = '—',
}) {
  for (final key in keys) {
    final value = data[key];
    if (value == null) continue;
    if (value is Map) {
      for (final nestedKey in const ['hoTen', 'fullName', 'name', 'label']) {
        final nested = value[nestedKey];
        if (nested != null && nested.toString().trim().isNotEmpty) {
          return nested.toString().trim();
        }
      }
    }
    final text = value.toString().trim();
    if (text.isNotEmpty) return text;
  }
  return fallback;
}

String formatValue(Object? value) {
  if (value == null) return '—';
  if (value is bool) return value ? 'Có' : 'Không';
  if (value is num) return NumberFormat.decimalPattern('vi_VN').format(value);
  if (value is List || value is Map) {
    return const JsonEncoder.withIndent('  ').convert(value);
  }
  final text = value.toString();
  final date = DateTime.tryParse(text);
  if (date != null) {
    return DateFormat('dd/MM/yyyy HH:mm', 'vi_VN').format(date.toLocal());
  }
  return text;
}

String humanizeKey(String key) {
  final spaced = key
      .replaceAllMapped(
        RegExp(r'([a-z0-9])([A-Z])'),
        (match) => '${match[1]} ${match[2]}',
      )
      .replaceAll('_', ' ')
      .trim();
  if (spaced.isEmpty) return key;
  return '${spaced[0].toUpperCase()}${spaced.substring(1)}';
}
