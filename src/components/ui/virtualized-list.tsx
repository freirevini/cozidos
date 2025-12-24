import { List } from "react-window";
import { useRef, useEffect, useState, ReactNode, CSSProperties, ReactElement } from "react";

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  overscanCount?: number;
}

interface RowProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
}

function createRowComponent<T>() {
  return function RowComponent({
    index,
    style,
    items,
    renderItem,
  }: {
    ariaAttributes: {
      "aria-posinset": number;
      "aria-setsize": number;
      role: "listitem";
    };
    index: number;
    style: CSSProperties;
  } & RowProps<T>): ReactElement {
    return <div style={style}>{renderItem(items[index], index)}</div>;
  };
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  renderItem,
  className = "",
  overscanCount = 5,
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(500);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const availableHeight = window.innerHeight - rect.top - 20;
        setHeight(Math.max(300, availableHeight));
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  if (items.length === 0) {
    return null;
  }

  const RowComponent = createRowComponent<T>();

  return (
    <div ref={containerRef} className={className}>
      <List
        rowComponent={RowComponent}
        rowCount={items.length}
        rowHeight={itemHeight}
        rowProps={{ items, renderItem }}
        overscanCount={overscanCount}
        style={{ height }}
      />
    </div>
  );
}
