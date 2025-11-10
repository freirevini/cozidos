import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Tab {
  title: string;
  url: string;
}

interface SlideTabsProps {
  tabs: Tab[];
  currentPath: string;
}

export const SlideTabs = ({ tabs, currentPath }: SlideTabsProps) => {
  const [position, setPosition] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  });
  
  // Find the index of the current tab based on the path
  const initialSelected = tabs.findIndex(tab => tab.url === currentPath);
  const [selected, setSelected] = useState(initialSelected >= 0 ? initialSelected : 0);
  const tabsRef = useRef<(HTMLLIElement | null)[]>([]);

  // Update selected tab when route changes
  useEffect(() => {
    const currentIndex = tabs.findIndex(tab => tab.url === currentPath);
    if (currentIndex >= 0) {
      setSelected(currentIndex);
    }
  }, [currentPath, tabs]);

  useEffect(() => {
    const selectedTab = tabsRef.current[selected];
    if (selectedTab) {
      const { width } = selectedTab.getBoundingClientRect();
      setPosition({
        left: selectedTab.offsetLeft,
        width,
        opacity: 1,
      });
    }
  }, [selected]);

  return (
    <ul
      onMouseLeave={() => {
        const selectedTab = tabsRef.current[selected];
        if (selectedTab) {
          const { width } = selectedTab.getBoundingClientRect();
          setPosition({
            left: selectedTab.offsetLeft,
            width,
            opacity: 1,
          });
        }
      }}
      className="relative flex w-fit rounded-full border-2 border-primary bg-background p-0.5 md:p-1"
    >
      {tabs.map((tab, i) => (
        <Tab
          key={tab.url}
          ref={(el) => (tabsRef.current[i] = el)}
          setPosition={setPosition}
          onClick={() => setSelected(i)}
          url={tab.url}
          isSelected={i === selected}
        >
          {tab.title}
        </Tab>
      ))}

      <Cursor position={position} />
    </ul>
  );
};

const Tab = React.forwardRef<
  HTMLLIElement,
  {
    children: React.ReactNode;
    setPosition: (position: { left: number; width: number; opacity: number }) => void;
    onClick: () => void;
    url: string;
    isSelected: boolean;
  }
>(({ children, setPosition, onClick, url, isSelected }, ref) => {
  return (
    <li
      ref={ref}
      onClick={onClick}
      onMouseEnter={() => {
        if (!ref || typeof ref === 'function') return;
        const element = ref.current;
        if (!element) return;

        const { width } = element.getBoundingClientRect();

        setPosition({
          left: element.offsetLeft,
          width,
          opacity: 1,
        });
      }}
      className="relative z-10 block cursor-pointer"
    >
      <Link
        to={url}
        className={cn(
          "block px-2 py-1 md:px-4 md:py-2 text-[10px] md:text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap relative z-10 menu-glow",
          isSelected ? "text-background" : "text-foreground/70 hover:text-foreground"
        )}
      >
        {children}
      </Link>
    </li>
  );
});

Tab.displayName = "Tab";

const Cursor = ({ position }: { position: { left: number; width: number; opacity: number } }) => {
  return (
    <motion.li
      animate={{
        ...position,
      }}
      transition={{
        type: "spring",
        stiffness: 350,
        damping: 30,
      }}
      className="absolute z-0 h-[calc(100%-4px)] top-0.5 rounded-full bg-primary"
    />
  );
};
