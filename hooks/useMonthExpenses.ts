// src/hooks/useMonthExpenses.ts
import { useEffect, useMemo, useState } from "react";
import type { Expense } from "../src/models";
import { listenMonthExpenses } from "../src/services/expenses";
import { addMonths, toYearMonth } from "../src/utils/date";


export function useMonthExpenses(projectId: string) {
    const [currentDate, setCurrentDate] = useState(() => new Date());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<Expense[]>([]);


    const yearMonth = useMemo(() => toYearMonth(currentDate), [currentDate]);


    useEffect(() => {
        setLoading(true);
        setError(null);
        const unsub = listenMonthExpenses(
            projectId,          // 👈
            yearMonth,
            (arr) => { setItems(arr); setLoading(false); },
            (e) => { setError(e?.message ?? "Error"); setLoading(false); }
        );
        return () => unsub();
    }, [projectId, yearMonth]);


    const totalCents = useMemo(
        () => items.reduce((acc, it) => acc + (it.amountCents || 0), 0),
        [items]
    );


    return {
        items,
        totalCents,
        yearMonth,
        loading,
        error,
        nextMonth: () => setCurrentDate((d) => addMonths(d, 1)),
        prevMonth: () => setCurrentDate((d) => addMonths(d, -1)),
    };
}