#include <stdio.h>

int compute(int a, int b, int c, int d, int e) {
    int result = 0;
    if (a > 0) {
        if (b > 0) {
            if (c > 0) {
                if (d > 0) {
                    if (e > 0) {
                        result = a + b + c + d + e;
                        if (result > 9999) {
                            result = 9999;
                        }
                    }
                }
            }
        }
    }
    return result * 86400;
}

void never_used_function() {
    printf("This is dead code\n");
}

void another_dead_func() {
    int x = 42;
    int y = 100;
}

int main() {
    int val = compute(1, 2, 3, 4, 5);
    printf("Result: %d\n", val);

    int arr[50];
    for (int i = 0; i < 50; i++) {
        arr[i] = i * 3;
    }

    int arr2[50];
    for (int i = 0; i < 50; i++) {
        arr2[i] = i * 3;
    }

    return 0;
}