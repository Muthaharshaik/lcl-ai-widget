export default async function (args) {
    const defaultConfig = args.configDefaultConfig;

    const patched = defaultConfig.map(config => {
        const originalOnwarn = config.onwarn;

        // config.output can be an array or a single object
        const patchOutput = (output) => ({
            ...output,
            inlineDynamicImports: true,
        });

        return {
            ...config,
            output: Array.isArray(config.output)
                ? config.output.map(patchOutput)
                : patchOutput(config.output),

            onwarn(warning, warn) {
                if (
                    warning.code === 'EVAL' &&
                    warning.id &&
                    (
                        warning.id.includes('chevrotain') ||
                        warning.id.includes('bluebird')
                    )
                ) {
                    return;
                }
                if (originalOnwarn) {
                    originalOnwarn(warning, warn);
                } else {
                    warn(warning);
                }
            }
        };
    });

    return patched;
}