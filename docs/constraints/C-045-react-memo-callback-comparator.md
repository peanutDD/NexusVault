# C-045: React Memo Comparators Must Include Callback Props

Custom `React.memo` comparators must compare every prop that can affect rendered
behavior, including callback props. Ignoring callbacks can keep stale event
handlers attached after a parent rerender.

Prefer the default shallow `memo` comparison unless a measured hotspot needs a
custom comparator. When adding or changing a custom comparator, add a regression
test that rerenders the component with a changed callback and proves the new
callback is used.
